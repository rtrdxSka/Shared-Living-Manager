import { describe, it, expect } from 'vitest';
import { computeSettlement } from '../settlementMatrix';
import type { ExpenseResponse } from '@/types/expense.types';

const members = [
  { userId: 'a', nickname: 'Alice' },
  { userId: 'b', nickname: 'Bob' },
  { userId: 'c', nickname: 'Carol' },
];

function makeExpense(partial: Partial<ExpenseResponse>): ExpenseResponse {
  return {
    _id: partial._id ?? 'x',
    householdId: 'h1',
    description: 'test',
    amount: partial.amount ?? 0,
    category: 'other',
    date: '2026-05-21',
    isResolved: false,
    isFullRepayment: false,
    paidByUserId: partial.paidByUserId,
    participantUserIds: partial.participantUserIds,
    customSplitOverrides: partial.customSplitOverrides,
    ...partial,
  } as ExpenseResponse;
}

describe('computeSettlement', () => {
  it('all-share equal split: Alice paid 30, two others owe 10 each', () => {
    const expenses = [makeExpense({ amount: 30, paidByUserId: 'a' })];
    const result = computeSettlement(members, expenses, 'equal');
    const fromBob = result.find((t) => t.from === 'b' && t.to === 'a');
    const fromCarol = result.find((t) => t.from === 'c' && t.to === 'a');
    expect(fromBob?.amount).toBeCloseTo(10);
    expect(fromCarol?.amount).toBeCloseTo(10);
  });

  it('subgroup expense: Bob pays 20 for Bob+Carol, Carol owes Bob 10, Alice untouched', () => {
    const expenses = [
      makeExpense({
        amount: 20,
        paidByUserId: 'b',
        participantUserIds: ['b', 'c'],
      }),
    ];
    const result = computeSettlement(members, expenses, 'equal');
    const carolToBob = result.find((t) => t.from === 'c' && t.to === 'b');
    expect(carolToBob?.amount).toBeCloseTo(10);
    expect(result.find((t) => t.from === 'a' || t.to === 'a')).toBeUndefined();
  });

  it('customSplitOverrides honored: 60/40 split between Alice and Bob, Alice paid 100', () => {
    const expenses = [
      makeExpense({
        amount: 100,
        paidByUserId: 'a',
        participantUserIds: ['a', 'b'],
        customSplitOverrides: [
          { userId: 'a', pct: 60 },
          { userId: 'b', pct: 40 },
        ],
      }),
    ];
    const result = computeSettlement(members, expenses, 'custom');
    const bobToAlice = result.find((t) => t.from === 'b' && t.to === 'a');
    expect(bobToAlice?.amount).toBeCloseTo(40);
  });

  it('symmetric expenses cancel out partially: Alice 60, Bob 60, both contribute equally — Carol owes 20 each, netted', () => {
    const expenses = [
      makeExpense({ amount: 60, paidByUserId: 'a' }),
      makeExpense({ amount: 60, paidByUserId: 'b' }),
    ];
    const result = computeSettlement(members, expenses, 'equal');
    const total = result.reduce((s, t) => s + t.amount, 0);
    // Alice and Bob cancel; only Carol's 40 = (60+60)/3 should flow out
    expect(total).toBeCloseTo(40);
  });

  it('skips resolved expenses', () => {
    const expenses = [makeExpense({ amount: 30, paidByUserId: 'a', isResolved: true })];
    expect(computeSettlement(members, expenses, 'equal')).toEqual([]);
  });

  it('skips expenses with no payer', () => {
    const expenses = [makeExpense({ amount: 30 })];
    expect(computeSettlement(members, expenses, 'equal')).toEqual([]);
  });

  it('income_based split with provided incomeSplit', () => {
    const expenses = [makeExpense({ amount: 100, paidByUserId: 'a' })];
    const result = computeSettlement(members, expenses, 'income_based', {
      byUserId: { a: 50, b: 30, c: 20 },
    });
    const bobToAlice = result.find((t) => t.from === 'b' && t.to === 'a');
    const carolToAlice = result.find((t) => t.from === 'c' && t.to === 'a');
    expect(bobToAlice?.amount).toBeCloseTo(30);
    expect(carolToAlice?.amount).toBeCloseTo(20);
  });
});
