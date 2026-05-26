import { describe, it, expect } from 'vitest';
import {
  fmt,
  stepMonth,
  formatMonthLabel,
  currentMonthString,
  getDueDateStatus,
  formatDueDate,
  deriveCustomSplit,
  deriveRoommateCustomShares,
  getMyShareLabel,
  myShareFromDebtorStates,
} from '../dashboardHelpers';
import type { HouseholdResponse } from '@/types/household.types';
import type { ExpenseResponse } from '@/types/expense.types';

function makeExpenseResponse(o: Partial<ExpenseResponse> = {}): ExpenseResponse {
  return {
    _id: 'e1',
    householdId: 'h1',
    amount: 500,
    category: 'rent',
    date: '2026-05-01',
    description: 'Rent',
    isResolved: false,
    isFullRepayment: false,
    debtorStates: [],
    createdByUserId: 'u-a',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...o,
  } as ExpenseResponse;
}

// Minimal household: the stored customSplitPercentage is the OWNER's share.
function makeHousehold(opts: {
  customSplitPercentage?: number;
  withOwner?: boolean;
}): HouseholdResponse {
  const owner = {
    _id: 'm-owner',
    userId: 'u-owner',
    nickname: 'Owner',
    role: opts.withOwner === false ? 'member' : 'owner',
    participatesInFinances: true,
  };
  const partner = {
    _id: 'm-partner',
    userId: 'u-partner',
    nickname: 'Partner',
    role: 'member',
    participatesInFinances: true,
  };
  return {
    settings: { customSplitPercentage: opts.customSplitPercentage },
    members: [owner, partner],
  } as unknown as HouseholdResponse;
}

describe('fmt', () => {
  it('formats integers without decimals', () => {
    expect(fmt(1200)).toBe('1,200');
  });
  it('rounds to 2 decimals', () => {
    expect(fmt(12.345)).toBe('12.35');
  });
  it('preserves trailing significant digit', () => {
    expect(fmt(12.4)).toBe('12.4');
  });
});

describe('stepMonth', () => {
  it('moves forward', () => {
    expect(stepMonth('2026-04', 'next')).toBe('2026-05');
  });
  it('moves backward across year boundary', () => {
    expect(stepMonth('2026-01', 'prev')).toBe('2025-12');
  });
});

describe('formatMonthLabel', () => {
  it('formats a YYYY-MM string to a human label', () => {
    expect(formatMonthLabel('2026-05')).toMatch(/May 2026/);
  });
});

describe('currentMonthString', () => {
  it('returns YYYY-MM for the current month', () => {
    expect(currentMonthString()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('getDueDateStatus', () => {
  it('returns "none" when dueDate is undefined', () => {
    expect(getDueDateStatus(undefined, false)).toBe('none');
  });
  it('returns "overdue" for a past date on incomplete task', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(yesterday, false)).toBe('overdue');
  });
  it('returns "due-today" for today', () => {
    expect(getDueDateStatus(new Date().toISOString(), false)).toBe('due-today');
  });
  it('returns "upcoming" for a future date', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(tomorrow, false)).toBe('upcoming');
  });
  it('returns "none" for completed tasks regardless of date', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDueDateStatus(yesterday, true)).toBe('none');
  });
});

describe('formatDueDate', () => {
  it('returns a non-empty human-readable string for tomorrow', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const out = formatDueDate(tomorrow);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('deriveCustomSplit', () => {
  it('gives the owner the stored percentage as their own share', () => {
    const hh = makeHousehold({ customSplitPercentage: 70 });
    expect(deriveCustomSplit(hh, 'u-owner')).toEqual({ myPct: 70, partnerPct: 30 });
  });

  it('flips the stored percentage for the non-owner partner', () => {
    const hh = makeHousehold({ customSplitPercentage: 70 });
    // Stored 70 is the OWNER's share, so the partner's own share is 30.
    expect(deriveCustomSplit(hh, 'u-partner')).toEqual({ myPct: 30, partnerPct: 70 });
  });

  it('falls back to 50/50 when no member is the owner (mirrors backend equal split)', () => {
    const hh = makeHousehold({ customSplitPercentage: 70, withOwner: false });
    expect(deriveCustomSplit(hh, 'u-owner')).toEqual({ myPct: 50, partnerPct: 50 });
  });

  it('defaults to 50/50 when customSplitPercentage is unset', () => {
    const hh = makeHousehold({});
    expect(deriveCustomSplit(hh, 'u-owner')).toEqual({ myPct: 50, partnerPct: 50 });
  });
});

// Roommate household with N finance members and optional stored shares.
function makeRoommateHousehold(
  members: { userId: string; nickname: string }[],
  customSplitShares?: { userId: string; pct: number }[]
): HouseholdResponse {
  return {
    settings: { customSplitShares },
    members: members.map((m) => ({
      _id: `m-${m.userId}`,
      userId: m.userId,
      nickname: m.nickname,
      role: 'member',
      participatesInFinances: true,
    })),
  } as unknown as HouseholdResponse;
}

const THREE = [
  { userId: 'u-a', nickname: 'Ann' },
  { userId: 'u-b', nickname: 'Bob' },
  { userId: 'u-c', nickname: 'Cy' },
];

describe('deriveRoommateCustomShares', () => {
  it('returns the stored shares when they exactly cover the members and sum to 100', () => {
    const hh = makeRoommateHousehold(THREE, [
      { userId: 'u-a', pct: 50 },
      { userId: 'u-b', pct: 30 },
      { userId: 'u-c', pct: 20 },
    ]);
    expect(deriveRoommateCustomShares(hh)).toEqual([
      { userId: 'u-a', nickname: 'Ann', pct: 50 },
      { userId: 'u-b', nickname: 'Bob', pct: 30 },
      { userId: 'u-c', nickname: 'Cy', pct: 20 },
    ]);
  });

  it('falls back to an even split (remainder to the first) when shares are unset', () => {
    const hh = makeRoommateHousehold(THREE);
    expect(deriveRoommateCustomShares(hh)).toEqual([
      { userId: 'u-a', nickname: 'Ann', pct: 34 },
      { userId: 'u-b', nickname: 'Bob', pct: 33 },
      { userId: 'u-c', nickname: 'Cy', pct: 33 },
    ]);
  });

  it('falls back to even when stored shares no longer cover the current members (member joined)', () => {
    const hh = makeRoommateHousehold(THREE, [
      { userId: 'u-a', pct: 60 },
      { userId: 'u-b', pct: 40 },
    ]);
    expect(deriveRoommateCustomShares(hh).map((s) => s.pct)).toEqual([34, 33, 33]);
  });

  it('falls back to even when stored shares do not sum to 100', () => {
    const hh = makeRoommateHousehold(THREE, [
      { userId: 'u-a', pct: 50 },
      { userId: 'u-b', pct: 30 },
      { userId: 'u-c', pct: 10 },
    ]);
    expect(deriveRoommateCustomShares(hh).map((s) => s.pct)).toEqual([34, 33, 33]);
  });
});

describe('myShareFromDebtorStates', () => {
  it('returns the debtor entry for a debtor', () => {
    const e = makeExpenseResponse({
      amount: 500,
      paidByUserId: 'u-a',
      debtorStates: [{ userId: 'u-b', share: 150 }],
    });
    expect(myShareFromDebtorStates(e, 'u-b')).toBe(150);
  });

  it('returns amount minus debtor total for the payer', () => {
    const e = makeExpenseResponse({
      amount: 500,
      paidByUserId: 'u-a',
      debtorStates: [{ userId: 'u-b', share: 150 }],
    });
    expect(myShareFromDebtorStates(e, 'u-a')).toBe(350);
  });

  it('returns 0 for a non-participant', () => {
    const e = makeExpenseResponse({
      amount: 500,
      paidByUserId: 'u-a',
      debtorStates: [{ userId: 'u-b', share: 150 }],
    });
    expect(myShareFromDebtorStates(e, 'u-c')).toBe(0);
  });
});

describe('getMyShareLabel — resolved uses the frozen snapshot', () => {
  it('a resolved expense reads debtorStates, ignoring the current customMyPct', () => {
    const resolved = makeExpenseResponse({
      amount: 500,
      paidByUserId: 'u-a',
      isResolved: true,
      debtorStates: [{ userId: 'u-b', share: 150 }],
    });
    // customMyPct is deliberately wrong (50) to prove it's ignored when resolved.
    // Payer (u-a) sees the residual 350; debtor (u-b) sees 150.
    expect(getMyShareLabel(resolved, 'custom', 50, null, 'EUR', 'Alice', 'u-a')).toMatch(
      /your share:\s*350\.00\s*EUR/i,
    );
    expect(getMyShareLabel(resolved, 'custom', 50, null, 'EUR', 'Bob', 'u-b')).toMatch(
      /your share:\s*150\.00\s*EUR/i,
    );
  });

  it('an unresolved custom expense still uses customMyPct (live)', () => {
    const unresolved = makeExpenseResponse({
      amount: 500,
      paidByUserId: 'u-a',
      isResolved: false,
      debtorStates: [{ userId: 'u-b', share: 150 }],
    });
    // Live custom 70% → 350 (70%), independent of the snapshot's 150.
    expect(getMyShareLabel(unresolved, 'custom', 70, null, 'EUR', 'Alice', 'u-a')).toMatch(
      /your share:\s*350\.00\s*EUR\s*\(70%\)/i,
    );
  });
});
