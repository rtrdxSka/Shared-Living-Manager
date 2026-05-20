import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  computeMemberAttributionsForExpense,
  type MemberAttribution,
} from '../../../src/utils/expenseShare';
import type {
  IHousehold,
  IHouseholdMember,
  IHouseholdSettings,
  FinanceMode,
  ExpenseSplitMethod,
} from '../../../src/types/household.types';
import type { IExpense } from '../../../src/types/expense.types';

// ── Fixture builders (inline, no DB) ─────────────────────────────────

interface MemberInit {
  nickname: string;
  role?: 'owner' | 'admin' | 'member';
  participatesInFinances?: boolean;
  monthlyIncome?: number;
  userId?: Types.ObjectId;
}

function makeMember(init: MemberInit): IHouseholdMember {
  return {
    _id: new Types.ObjectId(),
    userId: init.userId ?? new Types.ObjectId(),
    nickname: init.nickname,
    ageGroup: 'adult',
    role: init.role ?? 'member',
    participatesInFinances: init.participatesInFinances ?? true,
    participatesInTasks: true,
    isCreator: false,
    joinedAt: new Date(),
    monthlyIncome: init.monthlyIncome,
  } as IHouseholdMember;
}

function makeSettings(overrides: Partial<IHouseholdSettings> = {}): IHouseholdSettings {
  return {
    financeMode: 'split' as FinanceMode,
    expenseSplitMethod: 'equal' as ExpenseSplitMethod,
    trackedExpenseTypes: [],
    currency: 'EUR',
    taskManagementEnabled: 'full',
    ...overrides,
  } as IHouseholdSettings;
}

function makeHousehold(
  members: IHouseholdMember[],
  settingsOverrides: Partial<IHouseholdSettings> = {}
): Pick<IHousehold, 'settings' | 'members'> {
  return {
    settings: makeSettings(settingsOverrides),
    members,
  } as Pick<IHousehold, 'settings' | 'members'>;
}

function makeExpense(args: {
  amount: number;
  paidByUserId?: Types.ObjectId;
  isFullRepayment?: boolean;
}): Pick<IExpense, 'amount' | 'paidByUserId' | 'isFullRepayment'> {
  return {
    amount: args.amount,
    paidByUserId: args.paidByUserId,
    isFullRepayment: args.isFullRepayment ?? false,
  } as Pick<IExpense, 'amount' | 'paidByUserId' | 'isFullRepayment'>;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('computeMemberAttributionsForExpense', () => {
  it('1. equal split, 2 members: A pays 1000 → A 500/1000, B 500/0', () => {
    const a = makeMember({ nickname: 'A' });
    const b = makeMember({ nickname: 'B' });
    const household = makeHousehold([a, b], { expenseSplitMethod: 'equal' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(2);
    expect(result.get(a._id.toString())).toEqual<MemberAttribution>({
      share: 500,
      paid: 1000,
    });
    expect(result.get(b._id.toString())).toEqual<MemberAttribution>({
      share: 500,
      paid: 0,
    });
  });

  it('2. equal split, solo (1 participating member): A pays 1000 → A 1000/1000', () => {
    const a = makeMember({ nickname: 'A' });
    const household = makeHousehold([a], { expenseSplitMethod: 'equal' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(1);
    expect(result.get(a._id.toString())).toEqual<MemberAttribution>({
      share: 1000,
      paid: 1000,
    });
  });

  it('3. income-based with both incomes: A=6000, B=4000, A pays 1000 → 600/400', () => {
    const a = makeMember({ nickname: 'A', monthlyIncome: 6000 });
    const b = makeMember({ nickname: 'B', monthlyIncome: 4000 });
    const household = makeHousehold([a, b], { expenseSplitMethod: 'income_based' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(2);
    const aAttr = result.get(a._id.toString())!;
    const bAttr = result.get(b._id.toString())!;
    expect(aAttr.share).toBeCloseTo(600, 5);
    expect(aAttr.paid).toBe(1000);
    expect(bAttr.share).toBeCloseTo(400, 5);
    expect(bAttr.paid).toBe(0);
  });

  it('4. income-based with missing income on a participating member → falls back to equal', () => {
    const a = makeMember({ nickname: 'A', monthlyIncome: 6000 });
    const b = makeMember({ nickname: 'B' }); // no monthlyIncome
    const household = makeHousehold([a, b], { expenseSplitMethod: 'income_based' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.get(a._id.toString())?.share).toBe(500);
    expect(result.get(b._id.toString())?.share).toBe(500);
  });

  it('5. income-based with zero total income → falls back to equal', () => {
    const a = makeMember({ nickname: 'A', monthlyIncome: 0 });
    const b = makeMember({ nickname: 'B', monthlyIncome: 0 });
    const household = makeHousehold([a, b], { expenseSplitMethod: 'income_based' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.get(a._id.toString())?.share).toBe(500);
    expect(result.get(b._id.toString())?.share).toBe(500);
  });

  it('6. custom split, owner=A, pct=70: B pays 1000 → A 700/0, B 300/1000', () => {
    const a = makeMember({ nickname: 'A', role: 'owner' });
    const b = makeMember({ nickname: 'B', role: 'member' });
    const household = makeHousehold([a, b], {
      expenseSplitMethod: 'custom',
      customSplitPercentage: 70,
    });
    const expense = makeExpense({ amount: 1000, paidByUserId: b.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(2);
    expect(result.get(a._id.toString())).toEqual<MemberAttribution>({
      share: 700,
      paid: 0,
    });
    expect(result.get(b._id.toString())).toEqual<MemberAttribution>({
      share: 300,
      paid: 1000,
    });
  });

  it('7. custom split with no owner role anywhere → falls back to equal', () => {
    const a = makeMember({ nickname: 'A', role: 'member' });
    const b = makeMember({ nickname: 'B', role: 'member' });
    const household = makeHousehold([a, b], {
      expenseSplitMethod: 'custom',
      customSplitPercentage: 70,
    });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.get(a._id.toString())?.share).toBe(500);
    expect(result.get(b._id.toString())?.share).toBe(500);
  });

  it('8. custom split with out-of-range percentage → falls back to equal', () => {
    const a = makeMember({ nickname: 'A', role: 'owner' });
    const b = makeMember({ nickname: 'B', role: 'member' });

    // pct = 0 (below min)
    const h1 = makeHousehold([a, b], {
      expenseSplitMethod: 'custom',
      customSplitPercentage: 0,
    });
    const r1 = computeMemberAttributionsForExpense(
      makeExpense({ amount: 1000, paidByUserId: a.userId }),
      h1
    );
    expect(r1.get(a._id.toString())?.share).toBe(500);
    expect(r1.get(b._id.toString())?.share).toBe(500);

    // pct = 150 (above max)
    const h2 = makeHousehold([a, b], {
      expenseSplitMethod: 'custom',
      customSplitPercentage: 150,
    });
    const r2 = computeMemberAttributionsForExpense(
      makeExpense({ amount: 1000, paidByUserId: a.userId }),
      h2
    );
    expect(r2.get(a._id.toString())?.share).toBe(500);
    expect(r2.get(b._id.toString())?.share).toBe(500);
  });

  it('9. isFullRepayment: A pays 500 → A 0/500, B 500/0', () => {
    const a = makeMember({ nickname: 'A' });
    const b = makeMember({ nickname: 'B' });
    const household = makeHousehold([a, b], { expenseSplitMethod: 'equal' });
    const expense = makeExpense({
      amount: 500,
      paidByUserId: a.userId,
      isFullRepayment: true,
    });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(2);
    expect(result.get(a._id.toString())).toEqual<MemberAttribution>({
      share: 0,
      paid: 500,
    });
    expect(result.get(b._id.toString())).toEqual<MemberAttribution>({
      share: 500,
      paid: 0,
    });
  });

  it('10. joint mode: A pays 1000 → both members have share=undefined, paid as expected', () => {
    const a = makeMember({ nickname: 'A' });
    const b = makeMember({ nickname: 'B' });
    const household = makeHousehold([a, b], { financeMode: 'joint' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(2);
    const aAttr = result.get(a._id.toString())!;
    const bAttr = result.get(b._id.toString())!;
    expect(aAttr.share).toBeUndefined();
    expect(aAttr.paid).toBe(1000);
    expect(bAttr.share).toBeUndefined();
    expect(bAttr.paid).toBe(0);
  });

  it('11. non-participating member is excluded from the returned map', () => {
    const a = makeMember({ nickname: 'A' });
    const b = makeMember({ nickname: 'B' });
    const c = makeMember({ nickname: 'C', participatesInFinances: false });
    const household = makeHousehold([a, b, c], { expenseSplitMethod: 'equal' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(2);
    expect(result.has(a._id.toString())).toBe(true);
    expect(result.has(b._id.toString())).toBe(true);
    expect(result.has(c._id.toString())).toBe(false);
    // Split is across the 2 participating members, not 3.
    expect(result.get(a._id.toString())?.share).toBe(500);
    expect(result.get(b._id.toString())?.share).toBe(500);
  });

  it('12. usage_based enum value behaves identically to equal', () => {
    const a = makeMember({ nickname: 'A' });
    const b = makeMember({ nickname: 'B' });
    const household = makeHousehold([a, b], { expenseSplitMethod: 'usage_based' });
    const expense = makeExpense({ amount: 1000, paidByUserId: a.userId });

    const result = computeMemberAttributionsForExpense(expense, household);

    expect(result.size).toBe(2);
    expect(result.get(a._id.toString())).toEqual<MemberAttribution>({
      share: 500,
      paid: 1000,
    });
    expect(result.get(b._id.toString())).toEqual<MemberAttribution>({
      share: 500,
      paid: 0,
    });
  });
});
