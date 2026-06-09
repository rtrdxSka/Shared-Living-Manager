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

  it('applies household customSplitShares per-member (roommates custom)', () => {
    const a = p({ role: 'owner' });
    const b = p();
    const c = p();
    const result = computeDebtorShares({
      amount: 1000,
      payerUserId: a.userId,
      participants: [a, b, c],
      splitMethod: 'custom',
      customSplitShares: [
        { userId: a.userId, pct: 50 },
        { userId: b.userId, pct: 30 },
        { userId: c.userId, pct: 20 },
      ],
    });
    expect(result).toHaveLength(2);
    const byUser = new Map(result.map((r) => [r.userId.toString(), r.share]));
    expect(byUser.get(b.userId.toString())).toBe(300);
    expect(byUser.get(c.userId.toString())).toBe(200);
  });

  it('falls back to equal when customSplitShares do not cover every participant', () => {
    const a = p();
    const b = p();
    const c = p();
    const result = computeDebtorShares({
      amount: 900,
      payerUserId: a.userId,
      participants: [a, b, c],
      splitMethod: 'custom',
      // missing c — stale after a member joined
      customSplitShares: [
        { userId: a.userId, pct: 60 },
        { userId: b.userId, pct: 40 },
      ],
    });
    expect(result.map((r) => r.share)).toEqual([300, 300]);
  });

  it('rescales household customSplitShares proportionally over a subgroup (sum < 100)', () => {
    const a = p();
    const b = p();
    const c = p();
    // Household shares cover everyone, but this expense is a subgroup of a + b
    // whose stored shares sum to 80, not 100. They are rescaled to keep their
    // relative weight (a 60 : b 20 → a 75% : b 25%) instead of falling back to
    // equal. a is the payer, so only b owes: 100 * 20/80 = 25.
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: a.userId,
      participants: [a, b],
      splitMethod: 'custom',
      customSplitShares: [
        { userId: a.userId, pct: 60 },
        { userId: b.userId, pct: 20 },
        { userId: c.userId, pct: 20 },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toEqual(b.userId);
    expect(result[0].share).toBe(25);
  });

  it('rescales household customSplitShares over a subgroup with multiple debtors', () => {
    const a = p();
    const b = p();
    const c = p();
    const d = p();
    // Subgroup a + b + c (d excluded); their shares 30/30/20 sum to 80 and are
    // rescaled to sum to 100. a pays, so b and c owe their rescaled shares.
    const result = computeDebtorShares({
      amount: 800,
      payerUserId: a.userId,
      participants: [a, b, c],
      splitMethod: 'custom',
      customSplitShares: [
        { userId: a.userId, pct: 30 },
        { userId: b.userId, pct: 30 },
        { userId: c.userId, pct: 20 },
        { userId: d.userId, pct: 20 },
      ],
    });
    expect(result).toHaveLength(2);
    const byUser = new Map(result.map((r) => [r.userId.toString(), r.share]));
    expect(byUser.get(b.userId.toString())).toBeCloseTo(300, 5); // 800 * 30/80
    expect(byUser.get(c.userId.toString())).toBeCloseTo(200, 5); // 800 * 20/80
  });

  it('per-expense customSplitOverrides win over household customSplitShares', () => {
    const a = p();
    const b = p();
    const result = computeDebtorShares({
      amount: 100,
      payerUserId: a.userId,
      participants: [a, b],
      splitMethod: 'custom',
      customSplitShares: [
        { userId: a.userId, pct: 50 },
        { userId: b.userId, pct: 50 },
      ],
      customSplitOverrides: [
        { userId: a.userId, pct: 10 },
        { userId: b.userId, pct: 90 },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toEqual(b.userId);
    expect(result[0].share).toBe(90);
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
