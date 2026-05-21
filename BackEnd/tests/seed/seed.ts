import { Types } from 'mongoose';

import { User } from '../../src/models/user.model';
import { Household } from '../../src/models/household.model';
import { Expense } from '../../src/models/expense.model';
import { Task } from '../../src/models/task.model';
import { Goal } from '../../src/models/goal.model';
import { ShoppingListItem } from '../../src/models/shopping-list-item.model';
import { JointAccountTransaction } from '../../src/models/joint-account-transaction.model';
import {
  computeDebtorShares,
  type SplitMethod,
  type ComputeDebtorSharesParticipant,
} from '../../src/utils/computeDebtorShares';

import usersData from './data/users.json';
import householdsData from './data/households.json';
import expensesData from './data/expenses.json';
import tasksData from './data/tasks.json';
import goalsData from './data/goals.json';
import shoppingData from './data/shopping-items.json';
import jointAccountData from './data/joint-account-tx.json';

type IdMap = Record<string, Types.ObjectId>;

const newId = (): Types.ObjectId => new Types.ObjectId();

export interface SeedResult {
  userIds: IdMap;        // user "key" → User._id
  householdIds: IdMap;   // household "key" → Household._id
  memberIds: IdMap;      // member "memberKey" → member subdoc _id
  expenseIds: IdMap;
  taskIds: IdMap;
  goalIds: IdMap;
  shoppingIds: IdMap;
  jointTxIds: IdMap;
}

/**
 * Seed the connected MongoDB database with deterministic fixture data.
 *
 * Inserts via Mongoose models (not insertMany) so all validation, defaults,
 * and pre('save') hooks fire (notably User password hashing and Household
 * invite-code generation).
 *
 * The caller is responsible for connecting to MongoDB and dropping the
 * database before invoking — see tests/setup.ts.
 */
export const seedDatabase = async (): Promise<SeedResult> => {
  // ── Users ───────────────────────────────────────────────────────────
  const userIds: IdMap = {};
  for (const u of usersData) {
    const _id = newId();
    userIds[u.key] = _id;
    // Use `new User().save()` (not insertMany) so the pre-save password hash hook fires.
    await new User({
      _id,
      email: u.email,
      password: u.password,
      firstName: u.firstName,
      lastName: u.lastName,
      isEmailVerified: u.isEmailVerified,
      preferences: u.preferences,
    }).save();
  }

  // ── Households ──────────────────────────────────────────────────────
  const householdIds: IdMap = {};
  const memberIds: IdMap = {};
  for (const h of householdsData) {
    const _id = newId();
    householdIds[h.key] = _id;

    const members = h.members.map((m) => {
      const memberObjectId = newId();
      memberIds[m.memberKey] = memberObjectId;
      return {
        _id: memberObjectId,
        userId: m.userKey ? userIds[m.userKey] : undefined,
        nickname: m.nickname,
        relationship: 'relationship' in m ? m.relationship : undefined,
        ageGroup: m.ageGroup,
        role: m.role,
        participatesInFinances: m.participatesInFinances,
        participatesInTasks: m.participatesInTasks,
        isCreator: m.isCreator,
        joinedAt: new Date(m.joinedAt),
        monthlyIncome: 'monthlyIncome' in m ? m.monthlyIncome : undefined,
      };
    });

    await new Household({
      _id,
      name: h.name,
      livingArrangement: h.livingArrangement,
      totalMembers: h.totalMembers,
      uiMode: h.uiMode,
      createdBy: userIds[h.createdByUserKey],
      inviteCode: h.inviteCode,
      members,
      settlements: h.settlements ?? [],
      settings: h.settings,
    }).save();

    // Backfill User.households / activeHousehold so auth-flow tests behave like prod.
    for (const m of h.members) {
      if (!m.userKey) continue;
      await User.updateOne(
        { _id: userIds[m.userKey] },
        { $addToSet: { households: _id }, $set: { activeHousehold: _id } }
      );
    }
  }

  // ── Expenses ────────────────────────────────────────────────────────
  const expenseIds: IdMap = {};

  // Pre-load household docs so we can compute debtorStates per expense.
  const householdById = new Map<string, Awaited<ReturnType<typeof Household.findById>>>();
  for (const [, hid] of Object.entries(householdIds)) {
    householdById.set(hid.toString(), await Household.findById(hid));
  }

  for (const e of expensesData) {
    const _id = newId();
    expenseIds[e.key] = _id;

    const householdId = householdIds[e.householdKey];
    const household = householdById.get(householdId.toString());

    // Build per-debtor states. Skip for solo / joint-mode (no settlement).
    let debtorStates: Array<{
      userId: Types.ObjectId;
      share: number;
      claimedAt?: Date;
      confirmedAt?: Date;
      disputedAt?: Date;
    }> = [];

    const autoResolveByMode =
      household?.settings?.financeMode === 'joint' || household?.uiMode === 'solo';

    if (!autoResolveByMode && e.paidByUserKey && household) {
      const splitMethod = (household.settings?.expenseSplitMethod ?? 'equal') as SplitMethod;
      const participants: ComputeDebtorSharesParticipant[] = household.members
        .filter((m) => m.participatesInFinances && m.userId)
        .map((m) => ({
          userId: m.userId as Types.ObjectId,
          monthlyIncome: m.monthlyIncome ?? undefined,
          role: m.role,
        }));
      const shares = computeDebtorShares({
        amount: e.amount,
        payerUserId: userIds[e.paidByUserKey],
        participants,
        splitMethod,
        customSplitPercentage: household.settings?.customSplitPercentage,
        isFullRepayment: e.isFullRepayment,
      });

      // Carry legacy resolution state onto the matching debtor entries.
      const pendingByUserId =
        'pendingConfirmationByUserKey' in e && e.pendingConfirmationByUserKey
          ? userIds[e.pendingConfirmationByUserKey]
          : undefined;
      const pendingAt =
        'pendingConfirmationAt' in e && e.pendingConfirmationAt
          ? new Date(e.pendingConfirmationAt)
          : undefined;
      const resolvedAt =
        'resolvedAt' in e && e.resolvedAt ? new Date(e.resolvedAt) : undefined;
      const resolvedByUserId =
        'resolvedByUserKey' in e && e.resolvedByUserKey
          ? userIds[e.resolvedByUserKey]
          : undefined;

      debtorStates = shares.map((s) => {
        const entry: {
          userId: Types.ObjectId;
          share: number;
          claimedAt?: Date;
          confirmedAt?: Date;
          disputedAt?: Date;
        } = { userId: s.userId, share: Math.round(s.share * 100) / 100 };
        if (
          pendingByUserId &&
          s.userId.toString() === pendingByUserId.toString() &&
          pendingAt
        ) {
          entry.claimedAt = pendingAt;
        }
        if (
          e.isResolved &&
          resolvedByUserId &&
          s.userId.toString() === resolvedByUserId.toString() &&
          resolvedAt
        ) {
          entry.confirmedAt = resolvedAt;
        }
        return entry;
      });
    }

    await Expense.create({
      _id,
      householdId,
      paidByUserId: e.paidByUserKey ? userIds[e.paidByUserKey] : undefined,
      createdByUserId: userIds[e.createdByUserKey],
      description: e.description,
      amount: e.amount,
      category: e.category,
      date: new Date(e.date),
      notes: 'notes' in e ? e.notes : undefined,
      isResolved: e.isResolved,
      isFullRepayment: e.isFullRepayment,
      resolvedAt: 'resolvedAt' in e && e.resolvedAt ? new Date(e.resolvedAt) : undefined,
      debtorStates,
    });
  }

  // ── Tasks ───────────────────────────────────────────────────────────
  // Use `new Task({ ..., createdAt }).save()` so the seeded createdAt is preserved
  // even though the schema has timestamps: true.
  const taskIds: IdMap = {};
  for (const t of tasksData) {
    const _id = newId();
    taskIds[t.key] = _id;
    await new Task({
      _id,
      householdId: householdIds[t.householdKey],
      title: t.title,
      notes: 'notes' in t ? t.notes : undefined,
      dueDate: 'dueDate' in t && t.dueDate ? new Date(t.dueDate) : undefined,
      createdByUserId: userIds[t.createdByUserKey],
      assignedToMemberId:
        'assignedToMemberKey' in t && t.assignedToMemberKey
          ? memberIds[t.assignedToMemberKey]
          : undefined,
      completedByMemberId:
        'completedByMemberKey' in t && t.completedByMemberKey
          ? memberIds[t.completedByMemberKey]
          : undefined,
      isCompleted: t.isCompleted,
      completedAt: 'completedAt' in t && t.completedAt ? new Date(t.completedAt) : undefined,
      createdAt: new Date(t.createdAt),
    }).save();
  }

  // ── Goals ───────────────────────────────────────────────────────────
  const goalIds: IdMap = {};
  for (const g of goalsData) {
    const _id = newId();
    goalIds[g.key] = _id;
    await new Goal({
      _id,
      householdId: householdIds[g.householdKey],
      name: g.name,
      description: 'description' in g ? g.description : undefined,
      targetAmount: g.targetAmount,
      deadline: 'deadline' in g && g.deadline ? new Date(g.deadline) : undefined,
      status: g.status,
      category: 'category' in g ? g.category : undefined,
      createdByUserId: userIds[g.createdByUserKey],
      contributions: g.contributions.map((c) => ({
        memberId: memberIds[c.memberKey],
        amount: c.amount,
        note: 'note' in c ? c.note : undefined,
        createdAt: new Date(c.createdAt),
      })),
    }).save();
  }

  // ── Shopping list ──────────────────────────────────────────────────
  const shoppingIds: IdMap = {};
  for (const s of shoppingData) {
    const _id = newId();
    shoppingIds[s.key] = _id;
    await ShoppingListItem.create({
      _id,
      householdId: householdIds[s.householdKey],
      name: s.name,
      quantity: 'quantity' in s ? s.quantity : undefined,
      notes: 'notes' in s ? s.notes : undefined,
      category: s.category,
      addedByUserId: userIds[s.addedByUserKey],
      isBought: s.isBought,
      boughtAt: 'boughtAt' in s && s.boughtAt ? new Date(s.boughtAt) : undefined,
      boughtByMemberId:
        'boughtByMemberKey' in s && s.boughtByMemberKey
          ? memberIds[s.boughtByMemberKey]
          : undefined,
    });
  }

  // ── Joint account transactions ─────────────────────────────────────
  // Use `new Doc({ ..., createdAt }).save()` so the seeded createdAt is preserved.
  const jointTxIds: IdMap = {};
  for (const tx of jointAccountData) {
    const _id = newId();
    jointTxIds[tx.key] = _id;
    await new JointAccountTransaction({
      _id,
      householdId: householdIds[tx.householdKey],
      memberId: memberIds[tx.memberKey],
      userId: userIds[tx.userKey],
      type: tx.type,
      amount: tx.amount,
      note: 'note' in tx ? tx.note : undefined,
      createdAt: new Date(tx.createdAt),
    }).save();
  }

  return {
    userIds,
    householdIds,
    memberIds,
    expenseIds,
    taskIds,
    goalIds,
    shoppingIds,
    jointTxIds,
  };
};
