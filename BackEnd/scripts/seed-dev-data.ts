import { Types } from 'mongoose';
import { User } from '../src/models/user.model';
import { Household } from '../src/models/household.model';
import { Expense } from '../src/models/expense.model';
import { RecurringExpense } from '../src/models/recurring-expense.model';
import { Task } from '../src/models/task.model';
import { Goal } from '../src/models/goal.model';
import { ShoppingListItem } from '../src/models/shopping-list-item.model';
import { RecurringShoppingItem } from '../src/models/recurring-shopping-item.model';
import { JointAccountTransaction } from '../src/models/joint-account-transaction.model';
import { Issue } from '../src/models/issue.model';
import { IssueComment } from '../src/models/issue-comment.model';
import { Vote } from '../src/models/vote.model';
import { VoteBallot } from '../src/models/vote-ballot.model';
import { HouseRule } from '../src/models/house-rule.model';
import type { IHousehold } from '../src/types/household.types';
import { computeDebtorShares } from '../src/utils/computeDebtorShares';

import usersData from './seed-data/users.json';
import householdsData from './seed-data/households.json';
import expensesData from './seed-data/expenses.json';
import recurringExpensesData from './seed-data/recurring-expenses.json';
import tasksData from './seed-data/tasks.json';
import goalsData from './seed-data/goals.json';
import shoppingData from './seed-data/shopping-items.json';
import recurringData from './seed-data/recurring-shopping-items.json';
import jointAccountData from './seed-data/joint-account-tx.json';
import issuesData from './seed-data/issues.json';
import issueCommentsData from './seed-data/issue-comments.json';
import votesData from './seed-data/votes.json';
import voteBallotsData from './seed-data/vote-ballots.json';
import houseRulesData from './seed-data/house-rules.json';

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
  issueIds: IdMap;
  voteIds: IdMap;
  houseRuleIds: IdMap;
  credentials: CredentialsRow[];
}

const newId = (): Types.ObjectId => new Types.ObjectId();

function buildTaskRotationConfig(
  raw: any,
  memberIdLookup: IdMap
): { orderedMemberIds: Types.ObjectId[]; startedAt: Date; periodDays: number } | undefined {
  if (!raw) return undefined;
  return {
    orderedMemberIds: raw.orderedMemberKeys.map((k: string) => memberIdLookup[k]),
    startedAt: new Date(Date.now() - raw.startedDaysAgo * 86400_000),
    periodDays: raw.periodDays ?? 7,
  };
}

export async function seedDevDatabase(): Promise<DevSeedResult> {
  const userIds: IdMap = {};
  const householdIds: IdMap = {};
  const memberIds: IdMap = {};
  const issueIds: IdMap = {};
  const voteIds: IdMap = {};
  const houseRuleIds: IdMap = {};

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

    const taskRotationConfig = buildTaskRotationConfig(
      (h.settings as any).taskRotationConfig,
      memberIds
    );
    const settingsToSave = {
      ...h.settings,
      ...(taskRotationConfig
        ? { taskRotationConfig }
        : { taskRotationConfig: undefined }),
    };

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
      settings: settingsToSave,
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
  // Pre-load households so we can compute per-debtor shares without re-fetching per expense.
  const householdById = new Map<string, IHousehold | null>();
  for (const [, hid] of Object.entries(householdIds)) {
    householdById.set(hid.toString(), await Household.findById(hid));
  }

  for (const e of expensesData) {
    const householdId = householdIds[e.householdKey];
    const household = householdById.get(householdId.toString());
    const autoResolveByMode =
      household?.settings?.financeMode === 'joint' || household?.uiMode === 'solo';

    const participantUserIds =
      'participantUserKeys' in e && Array.isArray((e as any).participantUserKeys)
        ? (e as any).participantUserKeys.map((k: string) => userIds[k])
        : undefined;
    const customSplitOverrides =
      'customSplitOverrides' in e && Array.isArray((e as any).customSplitOverrides)
        ? (e as any).customSplitOverrides.map((o: any) => ({
            userId: userIds[o.userKey],
            pct: o.pct,
          }))
        : undefined;

    let debtorStates: Array<{
      userId: Types.ObjectId;
      share: number;
      claimedAt?: Date;
      confirmedAt?: Date;
      disputedAt?: Date;
    }> = [];

    if (!autoResolveByMode && e.paidByUserKey && household) {
      const splitMethod = (household.settings?.expenseSplitMethod ?? 'equal') as
        'equal' | 'income_based' | 'usage_based' | 'custom';
      const allFinancialParticipants = household.members
        .filter((m) => m.participatesInFinances && m.userId)
        .map((m) => ({
          userId: m.userId as Types.ObjectId,
          monthlyIncome: m.monthlyIncome ?? undefined,
          role: m.role,
        }));
      const participantUserIdSet = participantUserIds
        ? new Set(participantUserIds.map((id: Types.ObjectId) => id.toString()))
        : null;
      const participants = participantUserIdSet
        ? allFinancialParticipants.filter((p) => participantUserIdSet.has(p.userId.toString()))
        : allFinancialParticipants;

      const shares = computeDebtorShares({
        amount: e.amount,
        payerUserId: userIds[e.paidByUserKey],
        participants,
        splitMethod,
        customSplitOverrides,
        customSplitPercentage: household.settings?.customSplitPercentage,
        isFullRepayment: e.isFullRepayment,
      });

      const pendingByUserId =
        'pendingConfirmationByUserKey' in e && (e as any).pendingConfirmationByUserKey
          ? userIds[(e as any).pendingConfirmationByUserKey]
          : undefined;
      const pendingAt =
        'pendingConfirmationAt' in e && (e as any).pendingConfirmationAt
          ? new Date((e as any).pendingConfirmationAt)
          : undefined;
      const resolvedAt =
        'resolvedAt' in e && (e as any).resolvedAt ? new Date((e as any).resolvedAt) : undefined;
      const resolvedByUserId =
        'resolvedByUserKey' in e && (e as any).resolvedByUserKey
          ? userIds[(e as any).resolvedByUserKey]
          : undefined;

      debtorStates = shares.map((s) => {
        const entry: {
          userId: Types.ObjectId;
          share: number;
          claimedAt?: Date;
          confirmedAt?: Date;
          disputedAt?: Date;
        } = { userId: s.userId, share: Math.round(s.share * 100) / 100 };
        if (pendingByUserId && s.userId.toString() === pendingByUserId.toString() && pendingAt) {
          entry.claimedAt = pendingAt;
        }
        if (e.isResolved && resolvedByUserId && s.userId.toString() === resolvedByUserId.toString() && resolvedAt) {
          entry.confirmedAt = resolvedAt;
        }
        return entry;
      });
    }

    await new Expense({
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
      participantUserIds,
      customSplitOverrides,
      debtorStates,
    }).save();
  }

  // ── Recurring expenses ──────────────────────────────────────────────
  for (const r of recurringExpensesData) {
    await new RecurringExpense({
      householdId: householdIds[r.householdKey],
      createdByUserId: userIds[r.createdByUserKey],
      description: r.description,
      amount: r.amount,
      category: r.category,
      interval: r.interval,
      payerMode: r.payerMode,
      fixedPayerUserId:
        'fixedPayerUserKey' in r && (r as any).fixedPayerUserKey
          ? userIds[(r as any).fixedPayerUserKey]
          : undefined,
      isActive: r.isActive,
      isFullRepayment: r.isFullRepayment,
      participantUserIds:
        'participantUserKeys' in r && Array.isArray((r as any).participantUserKeys)
          ? (r as any).participantUserKeys.map((k: string) => userIds[k])
          : undefined,
      customSplitOverrides:
        'customSplitOverrides' in r && Array.isArray((r as any).customSplitOverrides)
          ? (r as any).customSplitOverrides.map((o: any) => ({
              userId: userIds[o.userKey],
              pct: o.pct,
            }))
          : undefined,
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

  // ── Issues ───────────────────────────────────────────────────────────
  for (const i of issuesData) {
    const _id = newId();
    issueIds[i.key] = _id;
    const createdAt = new Date(Date.now() - i.createdDaysAgo * 86400_000);
    await new Issue({
      _id,
      householdId: householdIds[i.householdKey],
      authorId: userIds[i.authorUserKey],
      title: i.title,
      body: i.body,
      category: i.category,
      status: i.status,
      upvotedBy: (i.upvotedByUserKeys || []).map((k: string) => userIds[k]),
    }).save();
    // Mongoose's timestamps:true clobbers explicit createdAt on save AND treats
    // createdAt as immutable on Model.updateOne — use the raw collection driver
    // to back-set both timestamps.
    await Issue.collection.updateOne({ _id }, { $set: { createdAt, updatedAt: createdAt } });
  }

  // ── Issue comments ───────────────────────────────────────────────────
  for (const c of issueCommentsData) {
    const createdAt = new Date(Date.now() - c.createdDaysAgo * 86400_000);
    const doc = await new IssueComment({
      issueId: issueIds[c.issueKey],
      authorId: userIds[c.authorUserKey],
      body: c.body,
    }).save();
    await IssueComment.collection.updateOne(
      { _id: doc._id },
      { $set: { createdAt, updatedAt: createdAt } }
    );
  }

  // ── Votes ────────────────────────────────────────────────────────────
  for (const v of votesData) {
    const _id = newId();
    voteIds[v.key] = _id;
    const deadline = new Date(Date.now() + v.deadlineDaysFromNow * 86400_000);
    const closedAt =
      'closedDaysAgo' in v && (v as any).closedDaysAgo != null
        ? new Date(Date.now() - (v as any).closedDaysAgo * 86400_000)
        : undefined;
    await new Vote({
      _id,
      householdId: householdIds[v.householdKey],
      sourceIssueId:
        'sourceIssueKey' in v && (v as any).sourceIssueKey
          ? issueIds[(v as any).sourceIssueKey]
          : undefined,
      proposedBy: userIds[v.proposedByUserKey],
      proposedRuleTitle: v.proposedRuleTitle,
      proposedRuleText: v.proposedRuleText,
      threshold: v.threshold,
      deadline,
      status: v.status,
      closedAt,
    }).save();
  }

  // ── Vote ballots ─────────────────────────────────────────────────────
  for (const b of voteBallotsData) {
    await new VoteBallot({
      voteId: voteIds[b.voteKey],
      userId: userIds[b.userKey],
      choice: b.choice,
      castAt: new Date(),
    }).save();
  }

  // ── House rules ──────────────────────────────────────────────────────
  for (const r of houseRulesData) {
    const _id = newId();
    houseRuleIds[r.key] = _id;
    const passedAt = new Date(Date.now() - r.passedDaysAgo * 86400_000);
    await new HouseRule({
      _id,
      householdId: householdIds[r.householdKey],
      sourceVoteId: voteIds[r.sourceVoteKey],
      title: r.title,
      text: r.text,
      passedAt,
    }).save();
  }

  // ── Patch escalated issues with their vote ID ────────────────────────
  // HH2's escalated issue (issue-r2-dishes) references vote-r2-dishes-24h.
  // The issue was inserted in Task 8 before the vote existed, so back-link it now.
  const escalatedIssue = issuesData.find(
    (i) => i.status === 'escalated' && i.householdKey === 'roommates-2'
  );
  if (escalatedIssue) {
    await Issue.updateOne(
      { _id: issueIds[escalatedIssue.key] },
      { $set: { escalatedToVoteId: voteIds['vote-r2-dishes-24h'] } }
    );
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

      // Roommate-owner test hints
      let note = '';
      if (h.key === 'roommates-1' && m!.role === 'owner') {
        note = 'open + archived issues; joint-mode tooltip';
      } else if (h.key === 'roommates-2' && m!.role === 'owner') {
        note = 'active vote — cast your ballot + close-early';
      } else if (h.key === 'roommates-3' && m!.role === 'owner') {
        note = 'subgroup + custom% + recurring + passed rules';
      }

      credentials.push({
        email: u.email,
        password: u.password,
        role: m!.role,
        household: h.key,
        config: `${finance}, ${task}`,
        note,
      });
    }
  }

  return { userIds, householdIds, memberIds, issueIds, voteIds, houseRuleIds, credentials };
}
