import { Types } from 'mongoose';
import { User } from '../src/models/user.model';
import { Household } from '../src/models/household.model';
import { Expense } from '../src/models/expense.model';
import { Task } from '../src/models/task.model';
import { Goal } from '../src/models/goal.model';
import { ShoppingListItem } from '../src/models/shopping-list-item.model';
import { RecurringShoppingItem } from '../src/models/recurring-shopping-item.model';
import { JointAccountTransaction } from '../src/models/joint-account-transaction.model';

import usersData from './seed-data/users.json';
import householdsData from './seed-data/households.json';
import expensesData from './seed-data/expenses.json';
import tasksData from './seed-data/tasks.json';
import goalsData from './seed-data/goals.json';
import shoppingData from './seed-data/shopping-items.json';
import recurringData from './seed-data/recurring-shopping-items.json';
import jointAccountData from './seed-data/joint-account-tx.json';

type IdMap = Record<string, Types.ObjectId>;

export interface CredentialsRow {
  email: string;
  password: string;
  role: string;
  household: string;
  config: string;
  note: string;
}

export interface DevSeedResult {
  userIds: IdMap;
  householdIds: IdMap;
  memberIds: IdMap;
  credentials: CredentialsRow[];
}

const newId = (): Types.ObjectId => new Types.ObjectId();

export async function seedDevDatabase(): Promise<DevSeedResult> {
  const userIds: IdMap = {};
  const householdIds: IdMap = {};
  const memberIds: IdMap = {};

  // ── Users ───────────────────────────────────────────────────────────
  for (const u of usersData) {
    const _id = newId();
    userIds[u.key] = _id;
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
      // `inviteCodeExpiresAt: null` (or absent) in the JSON means "use schema
      // default (now + 7 days)" → spread an empty object to omit the field.
      // A truthy value (e.g. an expired ISO date) is passed through as a Date.
      ...(h.inviteCodeExpiresAt
        ? { inviteCodeExpiresAt: new Date(h.inviteCodeExpiresAt) }
        : {}),
    }).save();

    // Backfill User.households / activeHousehold (matches tests/seed/seed.ts).
    for (const m of h.members) {
      if (!m.userKey) continue;
      await User.updateOne(
        { _id: userIds[m.userKey] },
        { $addToSet: { households: _id }, $set: { activeHousehold: _id } }
      );
    }
  }

  // ── Expenses ────────────────────────────────────────────────────────
  for (const e of expensesData) {
    await new Expense({
      householdId: householdIds[e.householdKey],
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
      resolvedByUserId: 'resolvedByUserKey' in e && e.resolvedByUserKey ? userIds[e.resolvedByUserKey] : undefined,
      pendingConfirmation: e.pendingConfirmation,
      pendingConfirmationAt: 'pendingConfirmationAt' in e && e.pendingConfirmationAt ? new Date(e.pendingConfirmationAt) : undefined,
      pendingConfirmationByUserId: 'pendingConfirmationByUserKey' in e && e.pendingConfirmationByUserKey ? userIds[e.pendingConfirmationByUserKey] : undefined,
      lastDisputedAt: 'lastDisputedAt' in e && e.lastDisputedAt ? new Date(e.lastDisputedAt) : undefined,
    }).save();
  }

  // ── Tasks ───────────────────────────────────────────────────────────
  for (const t of tasksData) {
    await new Task({
      householdId: householdIds[t.householdKey],
      title: t.title,
      notes: 'notes' in t ? t.notes : undefined,
      dueDate: 'dueDate' in t && t.dueDate ? new Date(t.dueDate) : undefined,
      createdByUserId: userIds[t.createdByUserKey],
      assignedToMemberId: 'assignedToMemberKey' in t && t.assignedToMemberKey ? memberIds[t.assignedToMemberKey] : undefined,
      isCompleted: t.isCompleted,
      // If a future seed adds `completedByMemberKey` / `completedAt` to a task,
      // mirror the pattern from BackEnd/tests/seed/seed.ts:162-167 here.
      createdAt: new Date(t.createdAt),
    }).save();
  }

  // ── Goals ───────────────────────────────────────────────────────────
  for (const g of goalsData) {
    await new Goal({
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

  // ── Shopping list items ──────────────────────────────────────────────
  for (const s of shoppingData) {
    await new ShoppingListItem({
      householdId: householdIds[s.householdKey],
      name: s.name,
      notes: 'notes' in s ? s.notes : undefined,
      quantity: 'quantity' in s ? s.quantity : undefined,
      category: s.category,
      addedByUserId: userIds[s.addedByUserKey],
      isBought: s.isBought,
      boughtAt: 'boughtAt' in s && s.boughtAt ? new Date(s.boughtAt) : undefined,
      boughtByMemberId: 'boughtByMemberKey' in s && s.boughtByMemberKey ? memberIds[s.boughtByMemberKey] : undefined,
    }).save();
  }

  // ── Recurring shopping rules ─────────────────────────────────────────
  for (const r of recurringData) {
    await new RecurringShoppingItem({
      householdId: householdIds[r.householdKey],
      name: r.name,
      category: r.category,
      cadence: r.cadence,
      active: r.active,
      createdBy: userIds[r.createdByUserKey],
    }).save();
  }

  // ── Joint-account transactions ───────────────────────────────────────
  for (const tx of jointAccountData) {
    await new JointAccountTransaction({
      householdId: householdIds[tx.householdKey],
      memberId: memberIds[tx.memberKey],
      userId: userIds[tx.userKey],
      type: tx.type,
      amount: tx.amount,
      note: 'note' in tx ? tx.note : undefined,
      createdAt: new Date(tx.createdAt),
    }).save();
  }

  // ── Build credentials table ──────────────────────────────────────────
  const credentials: CredentialsRow[] = [];
  for (const u of usersData) {
    const memberHouseholds = householdsData
      .map((h) => ({ h, m: h.members.find((m) => m.userKey === u.key) }))
      .filter((x) => !!x.m);

    if (memberHouseholds.length === 0) {
      credentials.push({
        email: u.email,
        password: u.password,
        role: '—',
        household: '(none)',
        config: '—',
        note:
          u.key === 'peter' ? 'unverified' :
          u.key === 'quinn' ? `invite: ${householdsData.find((h) => h.key === 'invite-only')?.inviteCode ?? ''}` :
          'solo',
      });
      continue;
    }

    for (const { h, m } of memberHouseholds) {
      const finance =
        h.settings.financeMode === 'joint'
          ? 'joint'
          : `split/${h.settings.expenseSplitMethod ?? '?'}`;
      const task =
        h.settings.taskManagementEnabled === 'disabled'
          ? 'tasks: disabled'
          : `${h.settings.taskManagementEnabled}/${h.settings.taskDistributionMethod ?? '?'}`;
      credentials.push({
        email: u.email,
        password: u.password,
        role: m!.role,
        household: h.key,
        config: `${finance}, ${task}`,
        note: '',
      });
    }
  }

  return { userIds, householdIds, memberIds, credentials };
}
