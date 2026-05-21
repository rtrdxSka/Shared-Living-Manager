import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  computeDebtorShares,
  type ComputeDebtorSharesParticipant,
} from '../../../src/utils/computeDebtorShares';

const oid = () => new Types.ObjectId();

function p(
  overrides: Partial<ComputeDebtorSharesParticipant> = {}
): ComputeDebtorSharesParticipant {
  return {
    userId: oid(),
    role: 'member',
    ...overrides,
  };
}

describe('computeDebtorShares', () => {
  it('returns [] when payer is the only participant (solo)', () => {
    const a = p();
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: a.userId,
      participants: [a],
      splitMethod: 'equal',
    });
    expect(result).toEqual([]);
  });

  it('returns [] when participants is empty', () => {
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: oid(),
      participants: [],
      splitMethod: 'equal',
    });
    expect(result).toEqual([]);
  });

  it('splits equally between payer and one debtor (couple)', () => {
    const a = p();
    const b = p();
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: a.userId,
      participants: [a, b],
      splitMethod: 'equal',
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toEqual(b.userId);
    expect(result[0].share).toBe(50);
  });

  it('splits equally across N-1 debtors (roommates equal)', () => {
    const a = p();
    const b = p();
    const c = p();
    const d = p();
    const result = computeDebtorShares({
      amount: 90,
      payerUserId: a.userId,
      participants: [a, b, c, d],
      splitMethod: 'equal',
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.share)).toEqual([22.5, 22.5, 22.5]);
  });

  it('honors customSplitOverrides over splitMethod', () => {
    const a = p();
    const b = p();
    const c = p();
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: a.userId,
      participants: [a, b, c],
      splitMethod: 'equal',
      customSplitOverrides: [
        { userId: a.userId, pct: 10 },
        { userId: b.userId, pct: 60 },
        { userId: c.userId, pct: 30 },
      ],
    });
    expect(result).toHaveLength(2);
    const byUser = new Map(result.map((r) => [r.userId.toString(), r.share]));
    expect(byUser.get(b.userId.toString())).toBe(60);
    expect(byUser.get(c.userId.toString())).toBe(30);
  });

  it('honors income_based split', () => {
    const a = p({ monthlyIncome: 3000 });
    const b = p({ monthlyIncome: 7000 });
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: a.userId,
      participants: [a, b],
      splitMethod: 'income_based',
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toEqual(b.userId);
    expect(result[0].share).toBeCloseTo(70, 5);
  });

  it('falls back to equal split when income data is missing for income_based', () => {
    const a = p({ monthlyIncome: 3000 });
    const b = p();
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: a.userId,
      participants: [a, b],
      splitMethod: 'income_based',
    });
    expect(result[0].share).toBe(50);
  });

  it('honors couple custom split with customSplitPercentage and an owner', () => {
    const owner = p({ role: 'owner' });
    const partner = p({ role: 'member' });
    const result = computeDebtorShares({
      amount: 1000,
      payerUserId: partner.userId,
      participants: [owner, partner],
      splitMethod: 'custom',
      customSplitPercentage: 70,
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toEqual(owner.userId);
    expect(result[0].share).toBe(700);
  });

  it('falls back to equal when custom is selected but no owner found', () => {
    const a = p({ role: 'member' });
    const b = p({ role: 'member' });
    const result = computeDebtorShares({
      amount: 1000,
      payerUserId: a.userId,
      participants: [a, b],
      splitMethod: 'custom',
      customSplitPercentage: 70,
    });
    expect(result[0].share).toBe(500);
  });

  it('isFullRepayment makes each non-payer owe the full amount', () => {
    const a = p();
    const b = p();
    const result = computeDebtorShares({
      amount: 500,
      payerUserId: a.userId,
      participants: [a, b],
      splitMethod: 'equal',
      isFullRepayment: true,
    });
    expect(result).toEqual([{ userId: b.userId, share: 500 }]);
  });
});
