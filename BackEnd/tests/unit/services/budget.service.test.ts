import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { budgetService } from '../../../src/services/budget.service';
import { Budget } from '../../../src/models/budget.model';
import { BudgetSnapshot } from '../../../src/models/budget-snapshot.model';
import { Expense } from '../../../src/models/expense.model';
import { Household } from '../../../src/models/household.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { makeUser } from '../../helpers/factories';

const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

// ── getCurrent ────────────────────────────────────────────────────────

describe('budgetService.getCurrent', () => {
  it('returns the standing budget, lazily creating an empty one when none exists', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await Budget.deleteOne({ householdId: couple._id });
    const result = await budgetService.getCurrent(couple._id.toString(), alice._id.toString());

    expect(result.householdId.toString()).toBe(couple._id.toString());
    expect(result.categories).toEqual({});
  });

  it('forbids non-members with 403', async () => {
    const couple = FIXTURES.household('couple');
    const stranger = new Types.ObjectId().toString();
    await expect(
      budgetService.getCurrent(couple._id.toString(), stranger)
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── update ────────────────────────────────────────────────────────────

describe('budgetService.update', () => {
  it('replaces categories and bumps updatedAt', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice'); // owner

    const updated = await budgetService.update(
      couple._id.toString(),
      alice._id.toString(),
      { categories: { groceries: 300, subscriptions: 50 } }
    );
    expect(updated.categories.groceries).toBe(300);
    expect(updated.categories.subscriptions).toBe(50);
  });

  it('snapshots OLD values for the previous month before applying the edit, if no snapshot exists', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { groceries: 200 } },
      { upsert: true, new: true }
    );
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthString = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    await BudgetSnapshot.deleteOne({ householdId: couple._id, monthString: prevMonthString });

    await budgetService.update(
      couple._id.toString(),
      alice._id.toString(),
      { categories: { groceries: 350 } }
    );

    const snap = await BudgetSnapshot.findOne({ householdId: couple._id, monthString: prevMonthString });
    expect(snap).not.toBeNull();
    expect(snap!.categories.groceries).toBe(200);
  });

  it('forbids non-admin members with 403', async () => {
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob'); // role 'member', not admin
    await expect(
      budgetService.update(couple._id.toString(), bob._id.toString(), { categories: { groceries: 100 } })
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('rejects negative amounts with 400', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await expect(
      budgetService.update(couple._id.toString(), alice._id.toString(), { categories: { groceries: -1 } })
    ).rejects.toSatisfy(expectAppError(400));
  });

  it('rejects unknown category keys with 400', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await expect(
      budgetService.update(
        couple._id.toString(),
        alice._id.toString(),
        { categories: { bogus: 100 } as unknown as Record<string, number> }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });
});

// ── getForMonth ───────────────────────────────────────────────────────

describe('budgetService.getForMonth', () => {
  it('returns live budget for current month', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { rent: 500 } },
      { upsert: true }
    );
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const result = await budgetService.getForMonth(couple._id.toString(), alice._id.toString(), current);
    expect(result.source).toBe('live');
    expect(result.categories.rent).toBe(500);
  });

  it('lazy-creates a snapshot when a past month has none', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { rent: 600 } },
      { upsert: true }
    );
    const past = '2024-01';
    await BudgetSnapshot.deleteOne({ householdId: couple._id, monthString: past });
    const result = await budgetService.getForMonth(couple._id.toString(), alice._id.toString(), past);
    expect(result.source).toBe('snapshot');
    expect(result.categories.rent).toBe(600);
    const created = await BudgetSnapshot.findOne({ householdId: couple._id, monthString: past });
    expect(created).not.toBeNull();
  });
});

// ── getInsights ───────────────────────────────────────────────────────

describe('budgetService.getInsights', () => {
  it('aggregates spend-by-category and flags over-budget categories', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await Budget.findOneAndUpdate(
      { householdId: couple._id },
      { householdId: couple._id, categories: { groceries: 100, subscriptions: 50 } },
      { upsert: true }
    );

    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await Expense.create({
      householdId: couple._id,
      paidByUserId: alice._id,
      createdByUserId: alice._id,
      description: 'Food shop',
      amount: 120,
      category: 'groceries',
      date: new Date(now.getFullYear(), now.getMonth(), 15),
      isFullRepayment: false,
    });
    await Expense.create({
      householdId: couple._id,
      paidByUserId: alice._id,
      createdByUserId: alice._id,
      description: 'Netflix',
      amount: 30,
      category: 'subscriptions',
      date: new Date(now.getFullYear(), now.getMonth(), 16),
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      couple._id.toString(),
      alice._id.toString(),
      monthString,
      'household'
    );

    expect(insights.month).toBe(monthString);
    expect(insights.spendByCategory.groceries).toBeGreaterThanOrEqual(120);
    expect(insights.spendByCategory.subscriptions).toBeGreaterThanOrEqual(30);
    expect(insights.overBudgetCategories).toContain('groceries');
    expect(insights.monthlyTrend).toHaveLength(6);
    expect(insights.monthlyTrend[5].monthString).toBe(monthString);
    expect(insights.effectiveScope).toBe('household');
  });

  it('returns savingsRate when the requesting member has monthlyIncome set', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    await Household.updateOne(
      { _id: couple._id, 'members.userId': alice._id },
      { $set: { 'members.$.monthlyIncome': 1000 } }
    );
    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const insights = await budgetService.getInsights(
      couple._id.toString(),
      alice._id.toString(),
      monthString
    );
    expect(insights.monthlyIncome).toBe(1000);
    expect(insights.savingsRate).not.toBeNull();
    expect(insights.savingsRate!).toBeGreaterThanOrEqual(0);
    expect(insights.savingsRate!).toBeLessThanOrEqual(1);
  });

  it('returns null savingsRate when monthlyIncome is unset', async () => {
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    await Household.updateOne(
      { _id: couple._id, 'members.userId': bob._id },
      { $unset: { 'members.$.monthlyIncome': '' } }
    );
    const now = new Date();
    const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const insights = await budgetService.getInsights(
      couple._id.toString(),
      bob._id.toString(),
      monthString
    );
    expect(insights.monthlyIncome).toBeNull();
    expect(insights.savingsRate).toBeNull();
  });

  // ── byMember roll-up ────────────────────────────────────────────────

  /**
   * Build an isolated household for byMember tests so the per-suite seed
   * data doesn't contaminate per-member totals. Returns ids plus a stable
   * "isolated" month (`isolMonth`) we can target with date-filtered Expense
   * inserts without colliding with the existing live budget for the month.
   */
  const buildIsolatedHousehold = async (
    nicknames: string[],
    opts: {
      financeMode?: 'split' | 'joint';
      expenseSplitMethod?: 'equal' | 'income_based' | 'custom' | 'usage_based';
      monthlyIncomes?: number[];
    } = {}
  ): Promise<{
    householdId: Types.ObjectId;
    memberIds: Types.ObjectId[];
    userIds: Types.ObjectId[];
    isolMonth: string;
    monthDate: Date;
  }> => {
    const users = await Promise.all(nicknames.map(() => makeUser()));
    const memberIds = nicknames.map(() => new Types.ObjectId());
    const household = await new Household({
      name: `byMember-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      livingArrangement: nicknames.length === 1 ? 'alone' : 'couple',
      totalMembers: nicknames.length,
      uiMode: nicknames.length === 1 ? 'solo' : 'couple',
      createdBy: users[0]._id,
      inviteCode: `byMember-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      members: nicknames.map((nick, i) => ({
        _id: memberIds[i],
        userId: users[i]._id,
        nickname: nick,
        ageGroup: 'adult',
        role: i === 0 ? 'owner' : 'member',
        isCreator: i === 0,
        participatesInFinances: true,
        participatesInTasks: true,
        ...(opts.monthlyIncomes ? { monthlyIncome: opts.monthlyIncomes[i] } : {}),
      })),
      settings: {
        currency: 'BGN',
        taskManagementEnabled: 'disabled',
        trackedExpenseTypes: [],
        ...(opts.financeMode ? { financeMode: opts.financeMode } : {}),
        ...(opts.expenseSplitMethod ? { expenseSplitMethod: opts.expenseSplitMethod } : {}),
      },
    }).save();

    // Use a past month to keep the test deterministic and isolated. Build
    // a YYYY-MM string for a fixed isolated month and a representative date
    // safely inside it.
    const isolMonth = '2025-01';
    const monthDate = new Date(2025, 0, 15);

    // Seed an explicit live budget so getForMonth can lazy-create a snapshot.
    await Budget.create({ householdId: household._id, categories: {} });

    return {
      householdId: household._id,
      memberIds,
      userIds: users.map((u) => u._id),
      isolMonth,
      monthDate,
    };
  };

  it('rolls up per-member totals and per-category sums across both members (split/equal default)', async () => {
    const { householdId, memberIds, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob']);

    // Alice: 100 groceries + 30 subscriptions
    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Groceries A',
      amount: 100,
      category: 'groceries',
      date: monthDate,
      isFullRepayment: false,
    });
    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Netflix',
      amount: 30,
      category: 'subscriptions',
      date: monthDate,
      isFullRepayment: false,
    });
    // Bob: 50 groceries + 20 subscriptions
    await Expense.create({
      householdId,
      paidByUserId: userIds[1],
      createdByUserId: userIds[1],
      description: 'Groceries B',
      amount: 50,
      category: 'groceries',
      date: monthDate,
      isFullRepayment: false,
    });
    await Expense.create({
      householdId,
      paidByUserId: userIds[1],
      createdByUserId: userIds[1],
      description: 'Spotify',
      amount: 20,
      category: 'subscriptions',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    expect(insights.byMember).toHaveLength(2);
    const aliceRow = insights.byMember.find((r) => r.memberId === memberIds[0].toString());
    const bobRow = insights.byMember.find((r) => r.memberId === memberIds[1].toString());
    expect(aliceRow).toBeDefined();
    expect(bobRow).toBeDefined();
    expect(aliceRow!.nickname).toBe('Alice');
    expect(bobRow!.nickname).toBe('Bob');
    // Total of 200 across both members; equal split → 100 each (share).
    expect(aliceRow!.totalShare).toBe(100);
    expect(bobRow!.totalShare).toBe(100);
    // share-by-category mirrors equal split: groceries 150 → 75 each, subs 50 → 25 each.
    expect(aliceRow!.shareByCategory!.groceries).toBe(75);
    expect(aliceRow!.shareByCategory!.subscriptions).toBe(25);
    expect(bobRow!.shareByCategory!.groceries).toBe(75);
    expect(bobRow!.shareByCategory!.subscriptions).toBe(25);
    // Paid mirrors who fronted the cash.
    expect(aliceRow!.totalPaid).toBe(130);
    expect(bobRow!.totalPaid).toBe(70);
    expect(aliceRow!.paidByCategory.groceries).toBe(100);
    expect(aliceRow!.paidByCategory.subscriptions).toBe(30);
    expect(bobRow!.paidByCategory.groceries).toBe(50);
    expect(bobRow!.paidByCategory.subscriptions).toBe(20);
  });

  it('includes a zero-spend partner with totalShare 0 and empty shareByCategory in split mode', async () => {
    const { householdId, memberIds, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Quiet']);

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Solo shop',
      amount: 75,
      category: 'groceries',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    expect(insights.byMember).toHaveLength(2);
    const quiet = insights.byMember.find((r) => r.memberId === memberIds[1].toString());
    expect(quiet).toBeDefined();
    expect(quiet!.nickname).toBe('Quiet');
    // Quiet still owes half (equal split): share 37.5; paid nothing.
    expect(quiet!.totalShare).toBeCloseTo(37.5, 10);
    expect(quiet!.shareByCategory!.groceries).toBeCloseTo(37.5, 10);
    expect(quiet!.totalPaid).toBe(0);
    expect(quiet!.paidByCategory).toEqual({});
  });

  it('returns exactly one byMember entry for a solo household', async () => {
    const { householdId, memberIds, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Solo']);

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Solo expense',
      amount: 42,
      category: 'groceries',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    expect(insights.byMember).toHaveLength(1);
    expect(insights.byMember[0].memberId).toBe(memberIds[0].toString());
    // Solo: only member → share equals full amount, also paid it all.
    expect(insights.byMember[0].totalShare).toBe(42);
    expect(insights.byMember[0].shareByCategory!.groceries).toBe(42);
    expect(insights.byMember[0].totalPaid).toBe(42);
    expect(insights.byMember[0].paidByCategory.groceries).toBe(42);
  });

  it('still attributes share for expenses with no paidByUserId in split mode (paid sums exclude them)', async () => {
    const { householdId, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob']);

    // Alice pays one tracked expense
    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Tracked',
      amount: 60,
      category: 'groceries',
      date: monthDate,
      isFullRepayment: false,
    });
    // Untracked: NO paidByUserId. Still split across members for `share`.
    await Expense.create({
      householdId,
      createdByUserId: userIds[0],
      description: 'Untracked',
      amount: 25,
      category: 'groceries',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth,
      'household'
    );

    // Category total includes both.
    expect(insights.spendByCategory.groceries).toBe(85);

    // share sums across members equal the full category total (utility
    // still splits expenses with no payer in split mode).
    const perMemberGroceriesShare = insights.byMember.reduce(
      (sum, row) => sum + (row.shareByCategory?.groceries ?? 0),
      0
    );
    expect(perMemberGroceriesShare).toBeCloseTo(85, 10);

    // Paid sums across members exclude the unpaid one (no one fronted it).
    const perMemberGroceriesPaid = insights.byMember.reduce(
      (sum, row) => sum + (row.paidByCategory.groceries ?? 0),
      0
    );
    expect(perMemberGroceriesPaid).toBe(60);
    const perMemberTotalPaid = insights.byMember.reduce((sum, row) => sum + row.totalPaid, 0);
    expect(perMemberTotalPaid).toBe(60);
  });

  // ── scope=personal | household ───────────────────────────────────────

  it('scope=personal (default in split mode): totalSpent reflects only the user share', async () => {
    // Alice income 6000, Bob income 4000 → income_based: Alice 60%, Bob 40%.
    // 1600 rent paid by Alice → Alice share=960, Bob share=640.
    const { householdId, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob'], {
        financeMode: 'split',
        expenseSplitMethod: 'income_based',
        monthlyIncomes: [6000, 4000],
      });

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Rent',
      amount: 1600,
      category: 'rent',
      date: monthDate,
      isFullRepayment: false,
    });

    // Default scope is 'personal'.
    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    expect(insights.requestedScope).toBe('personal');
    expect(insights.effectiveScope).toBe('personal');
    expect(insights.totalSpent).toBeCloseTo(960, 5);
    expect(insights.spendByCategory.rent).toBeCloseTo(960, 5);
    // Savings rate uses Alice's income (6000) and her share (960).
    expect(insights.savingsRate).toBeCloseTo((6000 - 960) / 6000, 5);
  });

  it('scope=household: totalSpent is the household sum regardless of viewer', async () => {
    const { householdId, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob'], {
        financeMode: 'split',
        expenseSplitMethod: 'income_based',
        monthlyIncomes: [6000, 4000],
      });

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Rent',
      amount: 1600,
      category: 'rent',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth,
      'household'
    );

    expect(insights.requestedScope).toBe('household');
    expect(insights.effectiveScope).toBe('household');
    expect(insights.totalSpent).toBe(1600);
    expect(insights.spendByCategory.rent).toBe(1600);
  });

  it('joint mode: requested scope=personal is overridden to effectiveScope=household', async () => {
    const { householdId, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob'], { financeMode: 'joint' });

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Joint dinner',
      amount: 200,
      category: 'groceries',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth,
      'personal'
    );

    expect(insights.requestedScope).toBe('personal');
    expect(insights.effectiveScope).toBe('household');
    expect(insights.totalSpent).toBe(200);
    expect(insights.spendByCategory.groceries).toBe(200);
  });

  // ── New semantics: split/equal, split/income_based, joint, isFullRepayment ──

  it('split-mode equal: 1000 paid by Alice → each owes 500, Alice paid 1000, Bob paid 0', async () => {
    const { householdId, memberIds, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob'], {
        financeMode: 'split',
        expenseSplitMethod: 'equal',
      });

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Rent',
      amount: 1000,
      category: 'rent',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    const aliceRow = insights.byMember.find((r) => r.memberId === memberIds[0].toString())!;
    const bobRow = insights.byMember.find((r) => r.memberId === memberIds[1].toString())!;

    expect(aliceRow.totalShare).toBe(500);
    expect(aliceRow.shareByCategory!.rent).toBe(500);
    expect(aliceRow.totalPaid).toBe(1000);
    expect(aliceRow.paidByCategory.rent).toBe(1000);

    expect(bobRow.totalShare).toBe(500);
    expect(bobRow.shareByCategory!.rent).toBe(500);
    expect(bobRow.totalPaid).toBe(0);
    expect(bobRow.paidByCategory).toEqual({});
  });

  it('split-mode income_based (6000/4000): 1000 rent paid by Alice → shares 600/400', async () => {
    const { householdId, memberIds, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob'], {
        financeMode: 'split',
        expenseSplitMethod: 'income_based',
        monthlyIncomes: [6000, 4000],
      });

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Rent',
      amount: 1000,
      category: 'rent',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    const aliceRow = insights.byMember.find((r) => r.memberId === memberIds[0].toString())!;
    const bobRow = insights.byMember.find((r) => r.memberId === memberIds[1].toString())!;

    expect(aliceRow.totalShare).toBe(600);
    expect(aliceRow.shareByCategory!.rent).toBe(600);
    expect(aliceRow.totalPaid).toBe(1000);
    expect(aliceRow.paidByCategory.rent).toBe(1000);

    expect(bobRow.totalShare).toBe(400);
    expect(bobRow.shareByCategory!.rent).toBe(400);
    expect(bobRow.totalPaid).toBe(0);
    expect(bobRow.paidByCategory).toEqual({});
  });

  it('joint mode: totalShare and shareByCategory are undefined on every entry; totalPaid reflects payer', async () => {
    const { householdId, memberIds, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob'], {
        financeMode: 'joint',
        expenseSplitMethod: 'equal',
      });

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Rent',
      amount: 1000,
      category: 'rent',
      date: monthDate,
      isFullRepayment: false,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    const aliceRow = insights.byMember.find((r) => r.memberId === memberIds[0].toString())!;
    const bobRow = insights.byMember.find((r) => r.memberId === memberIds[1].toString())!;

    expect(aliceRow.totalShare).toBeUndefined();
    expect(aliceRow.shareByCategory).toBeUndefined();
    expect(bobRow.totalShare).toBeUndefined();
    expect(bobRow.shareByCategory).toBeUndefined();

    expect(aliceRow.totalPaid).toBe(1000);
    expect(aliceRow.paidByCategory.rent).toBe(1000);
    expect(bobRow.totalPaid).toBe(0);
    expect(bobRow.paidByCategory).toEqual({});
  });

  it('isFullRepayment: 500 paid by Alice with isFullRepayment=true → Alice share 0, Bob share 500', async () => {
    const { householdId, memberIds, userIds, isolMonth, monthDate } =
      await buildIsolatedHousehold(['Alice', 'Bob'], {
        financeMode: 'split',
        expenseSplitMethod: 'equal',
      });

    await Expense.create({
      householdId,
      paidByUserId: userIds[0],
      createdByUserId: userIds[0],
      description: 'Bob owes me',
      amount: 500,
      category: 'other',
      date: monthDate,
      isFullRepayment: true,
    });

    const insights = await budgetService.getInsights(
      householdId.toString(),
      userIds[0].toString(),
      isolMonth
    );

    const aliceRow = insights.byMember.find((r) => r.memberId === memberIds[0].toString())!;
    const bobRow = insights.byMember.find((r) => r.memberId === memberIds[1].toString())!;

    expect(aliceRow.totalShare).toBe(0);
    expect(aliceRow.shareByCategory!.other ?? 0).toBe(0);
    expect(aliceRow.totalPaid).toBe(500);
    expect(aliceRow.paidByCategory.other).toBe(500);

    expect(bobRow.totalShare).toBe(500);
    expect(bobRow.shareByCategory!.other).toBe(500);
    expect(bobRow.totalPaid).toBe(0);
    expect(bobRow.paidByCategory).toEqual({});
  });
});
