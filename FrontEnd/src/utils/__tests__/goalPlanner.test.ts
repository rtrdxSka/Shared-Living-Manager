import { describe, it, expect } from 'vitest';
import {
  splitContribution,
  isIncomeSplitIncomplete,
  monthsLeft,
  requiredMonthlyContribution,
  contributionsByMember,
  forecastFinishDate,
  crossedMilestone,
  allocateMonthlyBudget,
  type SplitContext,
} from '../goalPlanner';
import type { GoalResponse, GoalContributionResponse } from '@/types/goal.types';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const MS_PER_DAY = 86_400_000;
const isoDaysFromNow = (days: number) => new Date(NOW.getTime() + days * MS_PER_DAY).toISOString();

const EQUAL: SplitContext = { splitMethod: 'equal', incomeSplit: null, customMyPct: 50 };

function makeContribution(p: Partial<GoalContributionResponse> = {}): GoalContributionResponse {
  return {
    _id: p._id ?? 'c1',
    memberId: p.memberId ?? 'me',
    memberNickname: p.memberNickname ?? 'Alice',
    amount: p.amount ?? 0,
    note: p.note,
    createdAt: p.createdAt ?? NOW.toISOString(),
  };
}

function makeGoal(p: Partial<GoalResponse> = {}): GoalResponse {
  return {
    _id: p._id ?? 'g1',
    householdId: 'h1',
    name: p.name ?? 'Goal',
    description: p.description,
    targetAmount: p.targetAmount ?? 1000,
    currentAmount: p.currentAmount ?? 0,
    deadline: p.deadline,
    status: p.status ?? 'active',
    category: p.category,
    priority: p.priority ?? 'normal',
    createdByUserId: 'u1',
    completedAt: p.completedAt,
    contributions: p.contributions ?? [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

describe('splitContribution', () => {
  it('equal → 50/50', () => {
    expect(splitContribution(100, EQUAL)).toEqual({ mine: 50, partner: 50 });
  });

  it('income_based uses the income split', () => {
    const ctx: SplitContext = {
      splitMethod: 'income_based',
      incomeSplit: { myPct: 62, partnerPct: 38 },
      customMyPct: 50,
    };
    expect(splitContribution(100, ctx)).toEqual({ mine: 62, partner: 38 });
  });

  it('income_based with incomplete income falls back to 50/50', () => {
    const ctx: SplitContext = { splitMethod: 'income_based', incomeSplit: null, customMyPct: 50 };
    expect(isIncomeSplitIncomplete(ctx)).toBe(true);
    expect(splitContribution(100, ctx)).toEqual({ mine: 50, partner: 50 });
  });

  it('custom uses the user’s own resolved percentage', () => {
    const ctx: SplitContext = { splitMethod: 'custom', incomeSplit: null, customMyPct: 70 };
    expect(splitContribution(100, ctx)).toEqual({ mine: 70, partner: 30 });
  });

  it('partner takes the remainder so the two always sum to the amount', () => {
    const ctx: SplitContext = { splitMethod: 'custom', incomeSplit: null, customMyPct: 33 };
    const { mine, partner } = splitContribution(100, ctx);
    expect(mine + partner).toBeCloseTo(100);
  });
});

describe('monthsLeft', () => {
  it('counts whole months ahead, rounded up', () => {
    expect(monthsLeft(new Date('2026-07-01T00:00:00Z'), NOW)).toBe(6);
  });
  it('floors at 1 for a past deadline', () => {
    expect(monthsLeft(new Date('2025-01-01T00:00:00Z'), NOW)).toBe(1);
  });
});

describe('requiredMonthlyContribution', () => {
  it('returns null without a deadline', () => {
    expect(requiredMonthlyContribution(1200, undefined, NOW)).toBeNull();
  });
  it('returns 0 when already funded', () => {
    expect(requiredMonthlyContribution(0, '2026-07-01T00:00:00Z', NOW)).toBe(0);
  });
  it('divides remaining by months left', () => {
    expect(requiredMonthlyContribution(1200, '2026-07-01T00:00:00Z', NOW)).toBe(200);
  });
});

describe('contributionsByMember', () => {
  it('splits contributions into mine vs partner', () => {
    const goal = makeGoal({
      contributions: [
        makeContribution({ _id: 'a', memberId: 'me', amount: 300 }),
        makeContribution({ _id: 'b', memberId: 'partner', amount: 200 }),
        makeContribution({ _id: 'c', memberId: 'me', amount: 100 }),
      ],
    });
    expect(contributionsByMember(goal, 'me')).toEqual({ mine: 400, partner: 200 });
  });
});

describe('forecastFinishDate', () => {
  // Two £100 contributions starting 60 days ago → ~£100/mo pace.
  const paced = (deadline?: string) =>
    makeGoal({
      targetAmount: 1000,
      currentAmount: 200,
      deadline,
      contributions: [
        makeContribution({ _id: 'a', amount: 100, createdAt: isoDaysFromNow(-60) }),
        makeContribution({ _id: 'b', amount: 100, createdAt: isoDaysFromNow(-30) }),
      ],
    });

  it('already funded → ahead', () => {
    expect(forecastFinishDate(makeGoal({ currentAmount: 1000, targetAmount: 1000 }), NOW).status).toBe('ahead');
  });

  it('no contributions → unknown', () => {
    expect(forecastFinishDate(makeGoal({ deadline: isoDaysFromNow(90) }), NOW).status).toBe('unknown');
  });

  it('grades behind when the pace misses the deadline', () => {
    expect(forecastFinishDate(paced(isoDaysFromNow(100)), NOW).status).toBe('behind');
  });

  it('grades ahead when the pace finishes comfortably early', () => {
    expect(forecastFinishDate(paced(isoDaysFromNow(365)), NOW).status).toBe('ahead');
  });

  it('grades on-track near the deadline', () => {
    expect(forecastFinishDate(paced(isoDaysFromNow(250)), NOW).status).toBe('on-track');
  });

  it('returns a projected finish date but unknown status with no deadline', () => {
    const f = forecastFinishDate(paced(undefined), NOW);
    expect(f.status).toBe('unknown');
    expect(f.finishDate).not.toBeNull();
  });
});

describe('crossedMilestone', () => {
  it('detects crossing a single threshold', () => {
    expect(crossedMilestone(40, 55)).toBe(50);
  });
  it('returns the highest threshold when several are crossed at once', () => {
    expect(crossedMilestone(10, 80)).toBe(75);
  });
  it('detects reaching 100 exactly', () => {
    expect(crossedMilestone(90, 100)).toBe(100);
  });
  it('returns null when no threshold is crossed', () => {
    expect(crossedMilestone(51, 60)).toBeNull();
  });
});

describe('allocateMonthlyBudget', () => {
  it('funds scheduled goals then sends surplus to unscheduled', () => {
    const goals = [
      makeGoal({ _id: 'g1', name: 'Near', targetAmount: 600, deadline: isoDaysFromNow(181) }),
      makeGoal({ _id: 'g2', name: 'Far', targetAmount: 1200, deadline: isoDaysFromNow(365) }),
      makeGoal({ _id: 'g3', name: 'Someday', targetAmount: 500 }),
    ];
    const { rows, totals } = allocateMonthlyBudget(1000, goals, EQUAL, NOW);
    const byId = Object.fromEntries(rows.map((r) => [r.goalId, r]));

    expect(byId.g1.allocated).toBe(100);
    expect(byId.g1.status).toBe('funded');
    expect(byId.g2.allocated).toBe(100);
    expect(byId.g2.status).toBe('funded');
    expect(byId.g3.allocated).toBe(500); // capped at remaining
    expect(byId.g3.status).toBe('unscheduled');
    expect(byId.g1.mine).toBe(50); // equal split of allocated
    expect(totals.allocated).toBe(700);
    expect(totals.unallocated).toBe(300);
    expect(totals.shortfall).toBe(0);
  });

  it('prioritises the soonest deadline when the budget is tight', () => {
    const goals = [
      makeGoal({ _id: 'soon', name: 'Soon', targetAmount: 600, deadline: isoDaysFromNow(90) }), // needs 200/mo
      makeGoal({ _id: 'later', name: 'Later', targetAmount: 600, deadline: isoDaysFromNow(181) }), // needs 100/mo
    ];
    const { rows, totals } = allocateMonthlyBudget(120, goals, EQUAL, NOW);
    const byId = Object.fromEntries(rows.map((r) => [r.goalId, r]));

    expect(byId.soon.allocated).toBe(120);
    expect(byId.soon.status).toBe('underfunded');
    expect(byId.later.allocated).toBe(0);
    expect(byId.later.status).toBe('unfunded');
    expect(totals.shortfall).toBe(180); // (200-120) + (100-0)
    expect(totals.unallocated).toBe(0);
  });

  it('with no budget, still surfaces requirements and marks goals unfunded', () => {
    const goals = [makeGoal({ _id: 'g1', targetAmount: 600, deadline: isoDaysFromNow(181) })];
    const { rows, totals } = allocateMonthlyBudget(0, goals, EQUAL, NOW);
    expect(rows[0].required).toBe(100);
    expect(rows[0].allocated).toBe(0);
    expect(rows[0].status).toBe('unfunded');
    expect(totals.shortfall).toBe(100);
  });

  it('excludes funded and inactive goals', () => {
    const goals = [
      makeGoal({ _id: 'done', targetAmount: 100, currentAmount: 100, deadline: isoDaysFromNow(90) }),
      makeGoal({ _id: 'abandoned', status: 'abandoned', targetAmount: 500 }),
    ];
    const { rows } = allocateMonthlyBudget(500, goals, EQUAL, NOW);
    expect(rows).toHaveLength(0);
  });

  it('funds a High-priority goal before a sooner-deadline Normal goal', () => {
    const goals = [
      // Sooner deadline (90d → 200/mo) but only Normal priority.
      makeGoal({ _id: 'soon', targetAmount: 600, deadline: isoDaysFromNow(90), priority: 'normal' }),
      // Later deadline (181d → 100/mo) but High priority — should fund first.
      makeGoal({ _id: 'starred', targetAmount: 600, deadline: isoDaysFromNow(181), priority: 'high' }),
    ];
    // Budget only covers one goal's requirement (100).
    const { rows } = allocateMonthlyBudget(100, goals, EQUAL, NOW);
    const byId = Object.fromEntries(rows.map((r) => [r.goalId, r]));

    expect(byId.starred.allocated).toBe(100); // High wins the queue
    expect(byId.starred.status).toBe('funded');
    expect(byId.soon.allocated).toBe(0);
    expect(byId.soon.status).toBe('unfunded');
  });

  it('sends surplus to a High-priority unscheduled goal before a Low one', () => {
    const goals = [
      makeGoal({ _id: 'low', targetAmount: 500, priority: 'low' }),
      makeGoal({ _id: 'high', targetAmount: 500, priority: 'high' }),
    ];
    // 300 surplus, no scheduled goals → High filled first.
    const { rows } = allocateMonthlyBudget(300, goals, EQUAL, NOW);
    const byId = Object.fromEntries(rows.map((r) => [r.goalId, r]));

    expect(byId.high.allocated).toBe(300);
    expect(byId.low.allocated).toBe(0);
  });

  it('returns rows in funding order, each carrying its goal’s priority', () => {
    const goals = [
      // Sooner deadline but only Normal.
      makeGoal({ _id: 'soon', targetAmount: 600, deadline: isoDaysFromNow(90), priority: 'normal' }),
      // Later deadline but High → funds first, so leads the rows.
      makeGoal({ _id: 'starred', targetAmount: 600, deadline: isoDaysFromNow(181), priority: 'high' }),
      // Unscheduled → always trails the scheduled goals.
      makeGoal({ _id: 'someday', targetAmount: 500, priority: 'low' }),
    ];
    const { rows } = allocateMonthlyBudget(1000, goals, EQUAL, NOW);

    expect(rows.map((r) => r.goalId)).toEqual(['starred', 'soon', 'someday']);
    expect(rows.map((r) => r.priority)).toEqual(['high', 'normal', 'low']);
  });
});
