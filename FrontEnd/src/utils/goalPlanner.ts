import type { GoalResponse, GoalPriority } from '@/types/goal.types';
import type { ExpenseSplitMethod } from '@/types/onboarding.types';

/**
 * Pure planning engine behind the couple-mode "Together Fund" upgrade to Goals.
 *
 * Everything here is framed as POSITIVE, additive teamwork — how much each
 * partner contributes toward a shared dream — never as debt or "who owes whom".
 * No React, no I/O: deterministic functions over goal + split data so they can
 * be unit-tested in isolation and reasoned about for the write-up.
 */

const MS_PER_DAY = 86_400_000;
// Average days per month — gives deterministic month estimates from a date diff.
const AVG_DAYS_PER_MONTH = 30.44;

const MILESTONES = [25, 50, 75, 100] as const;
export type Milestone = (typeof MILESTONES)[number];

const PRIORITY_RANK: Record<GoalPriority, number> = { high: 2, normal: 1, low: 0 };

/** Numeric weight for a goal's priority (higher = funded first). */
export function priorityRank(priority: GoalPriority | undefined): number {
  return PRIORITY_RANK[priority ?? 'normal'];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Split ───────────────────────────────────────────────────────────────────

/**
 * How the active couple split divides any amount. `customMyPct` is the current
 * user's OWN percentage (already owner-resolved by `deriveCustomSplit`), so it
 * is used directly. `income_based` with a null `incomeSplit` (incomplete income
 * data) falls back to 50/50 — mirroring the rest of the app's split fallbacks.
 */
export interface SplitContext {
  splitMethod: ExpenseSplitMethod;
  incomeSplit: { myPct: number; partnerPct: number } | null;
  customMyPct: number;
}

/** Returns whether income data was incomplete, forcing the 50/50 fallback. */
export function isIncomeSplitIncomplete(ctx: SplitContext): boolean {
  return ctx.splitMethod === 'income_based' && ctx.incomeSplit === null;
}

function myPctFor(ctx: SplitContext): number {
  if (ctx.splitMethod === 'equal') return 50;
  if (ctx.splitMethod === 'income_based') return ctx.incomeSplit ? ctx.incomeSplit.myPct : 50;
  // 'custom' (and any other) → the user's resolved own percentage.
  return ctx.customMyPct;
}

/**
 * Split an amount into the current user's share and their partner's share under
 * the active split. The two always sum to `amount` (partner takes the remainder
 * so rounding never loses a cent).
 */
export function splitContribution(
  amount: number,
  ctx: SplitContext
): { mine: number; partner: number } {
  const mine = round2((amount * myPctFor(ctx)) / 100);
  return { mine, partner: round2(amount - mine) };
}

// ── Required monthly contribution ────────────────────────────────────────────

/** Whole months from `now` to `deadline`, rounded up, floored at 1 (past → 1). */
export function monthsLeft(deadline: Date, now: Date): number {
  const days = (deadline.getTime() - now.getTime()) / MS_PER_DAY;
  if (days <= 0) return 1;
  return Math.max(1, Math.ceil(days / AVG_DAYS_PER_MONTH));
}

/**
 * Monthly amount the couple needs to save to reach a goal by its deadline.
 * `null` when there is no deadline (nothing to pace against); `0` when the goal
 * is already funded.
 */
export function requiredMonthlyContribution(
  remaining: number,
  deadline: string | undefined,
  now: Date
): number | null {
  if (!deadline) return null;
  if (remaining <= 0) return 0;
  return round2(remaining / monthsLeft(new Date(deadline), now));
}

// ── Per-member contributions (the teamwork bar) ──────────────────────────────

/**
 * Split a goal's contributions into the current member's total and everyone
 * else's (the partner, in couple mode). Derived from the contribution list so
 * the two segments always sum to what's been contributed.
 */
export function contributionsByMember(
  goal: Pick<GoalResponse, 'contributions'>,
  myMemberId: string
): { mine: number; partner: number } {
  let mine = 0;
  let partner = 0;
  for (const c of goal.contributions) {
    if (c.memberId === myMemberId) mine += c.amount;
    else partner += c.amount;
  }
  return { mine: round2(mine), partner: round2(partner) };
}

// ── Forecast (pace → finish date) ────────────────────────────────────────────

export type ForecastStatus = 'ahead' | 'on-track' | 'behind' | 'unknown';

export interface Forecast {
  /** Projected completion date (ISO) from current pace, or null if unknowable. */
  finishDate: string | null;
  status: ForecastStatus;
}

/**
 * Project a goal's finish date from its contribution PACE so far, and grade it
 * against the deadline:
 *  - already funded            → 'ahead'
 *  - no deadline / no pace yet  → 'unknown'
 *  - finishes > ~1mo early      → 'ahead'
 *  - finishes within ~1mo       → 'on-track'
 *  - finishes after deadline    → 'behind'
 */
export function forecastFinishDate(
  goal: Pick<GoalResponse, 'currentAmount' | 'targetAmount' | 'deadline' | 'contributions'>,
  now: Date
): Forecast {
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) return { finishDate: null, status: 'ahead' };

  const contributions = goal.contributions;
  if (contributions.length === 0) return { finishDate: null, status: 'unknown' };

  const total = contributions.reduce((s, c) => s + c.amount, 0);
  if (total <= 0) return { finishDate: null, status: 'unknown' };

  const firstAt = contributions.reduce(
    (min, c) => Math.min(min, new Date(c.createdAt).getTime()),
    Infinity
  );
  // Months of saving observed so far (floored at 1 so a fresh goal reads as
  // "this month's pace" rather than an infinite rate).
  const elapsedMonths = Math.max(1, (now.getTime() - firstAt) / (AVG_DAYS_PER_MONTH * MS_PER_DAY));
  const monthlyRate = total / elapsedMonths;
  if (monthlyRate <= 0) return { finishDate: null, status: 'unknown' };

  const monthsToFinish = Math.ceil(remaining / monthlyRate);
  const finish = new Date(now.getTime() + monthsToFinish * AVG_DAYS_PER_MONTH * MS_PER_DAY);
  const finishDate = finish.toISOString();

  if (!goal.deadline) return { finishDate, status: 'unknown' };

  const deadline = new Date(goal.deadline).getTime();
  const oneMonth = AVG_DAYS_PER_MONTH * MS_PER_DAY;
  if (finish.getTime() > deadline) return { finishDate, status: 'behind' };
  if (finish.getTime() <= deadline - oneMonth) return { finishDate, status: 'ahead' };
  return { finishDate, status: 'on-track' };
}

// ── Milestones ───────────────────────────────────────────────────────────────

/**
 * The highest 25/50/75/100 threshold crossed when progress moves from
 * `prevPct` to `nextPct`. Used to fire a celebration on the contribution that
 * crosses it. `null` when no new threshold is reached.
 */
export function crossedMilestone(prevPct: number, nextPct: number): Milestone | null {
  let hit: Milestone | null = null;
  for (const m of MILESTONES) {
    if (prevPct < m && nextPct >= m) hit = m;
  }
  return hit;
}

// ── Multi-goal allocator ─────────────────────────────────────────────────────

export type AllocationStatus = 'funded' | 'underfunded' | 'unfunded' | 'unscheduled';

export interface AllocationRow {
  goalId: string;
  name: string;
  scheduled: boolean;
  /** Monthly amount needed to hit the deadline (null when unscheduled). */
  required: number | null;
  /** Amount the budget actually covers this month for this goal. */
  allocated: number;
  /** Per-partner split of `allocated`. */
  mine: number;
  partner: number;
  status: AllocationStatus;
  /** The goal's priority — surfaced so the plan can show why it's ranked here. */
  priority: GoalPriority;
}

export interface AllocationResult {
  rows: AllocationRow[];
  totals: {
    /** Sum of all `allocated`. */
    allocated: number;
    /** Budget left unspent after allocation. */
    unallocated: number;
    /** Total monthly shortfall against scheduled goals' requirements. */
    shortfall: number;
  };
}

const EPS = 0.005;

/**
 * Allocate a monthly savings `budget` across active goals.
 *
 * Greedy, priority-first: scheduled goals (those with a deadline) are funded in
 * order of priority (High → Normal → Low), then soonest deadline, then larger
 * requirement — up to each one's required monthly amount. Any surplus then flows
 * to unscheduled goals, highest priority (then most remaining) first, capped at
 * what each has left. Deterministic and explainable — the couple can always see
 * why a goal is funded or not.
 */
export function allocateMonthlyBudget(
  budget: number,
  goals: GoalResponse[],
  ctx: SplitContext,
  now: Date
): AllocationResult {
  type Entry = {
    goal: GoalResponse;
    remaining: number;
    scheduled: boolean;
    required: number | null;
    deadlineTime: number;
    rank: number;
  };

  const entries: Entry[] = goals
    .filter((g) => g.status === 'active')
    .map((g) => {
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);
      const scheduled = !!g.deadline;
      return {
        goal: g,
        remaining,
        scheduled,
        required: scheduled ? requiredMonthlyContribution(remaining, g.deadline, now) : null,
        deadlineTime: g.deadline ? new Date(g.deadline).getTime() : Infinity,
        rank: priorityRank(g.priority),
      };
    })
    .filter((e) => e.remaining > 0);

  // Funded amount per goal id.
  const allocated = new Map<string, number>();
  let budgetLeft = Math.max(0, budget);

  // 1) Scheduled goals: highest priority first, then soonest deadline, then
  //    larger requirement.
  const scheduled = entries
    .filter((e) => e.scheduled)
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        a.deadlineTime - b.deadlineTime ||
        (b.required ?? 0) - (a.required ?? 0)
    );

  for (const e of scheduled) {
    const need = e.required ?? 0;
    const give = Math.min(need, budgetLeft);
    allocated.set(e.goal._id, round2(give));
    budgetLeft = round2(budgetLeft - give);
  }

  // 2) Surplus → unscheduled goals, highest priority (then most remaining)
  //    first, each filled up to what it has left.
  const unscheduled = entries
    .filter((e) => !e.scheduled)
    .sort((a, b) => b.rank - a.rank || b.remaining - a.remaining);
  for (const e of unscheduled) {
    if (budgetLeft <= EPS) {
      allocated.set(e.goal._id, 0);
      continue;
    }
    const give = round2(Math.min(e.remaining, budgetLeft));
    allocated.set(e.goal._id, give);
    budgetLeft = round2(budgetLeft - give);
  }

  // Emit rows in the order the budget was actually spent (scheduled by
  // priority/deadline, then unscheduled) so the plan reads top-to-bottom as
  // "funded first → last" — making each goal's priority ranking visible.
  const fundingOrder = [...scheduled, ...unscheduled];
  const rows: AllocationRow[] = fundingOrder.map((e) => {
    const got = allocated.get(e.goal._id) ?? 0;
    const { mine, partner } = splitContribution(got, ctx);
    let status: AllocationStatus;
    if (!e.scheduled) {
      status = 'unscheduled';
    } else if (got >= (e.required ?? 0) - EPS) {
      status = 'funded';
    } else if (got > EPS) {
      status = 'underfunded';
    } else {
      status = 'unfunded';
    }
    return {
      goalId: e.goal._id,
      name: e.goal.name,
      scheduled: e.scheduled,
      required: e.required,
      allocated: got,
      mine,
      partner,
      status,
      priority: e.goal.priority ?? 'normal',
    };
  });

  const allocatedTotal = round2(rows.reduce((s, r) => s + r.allocated, 0));
  const shortfall = round2(
    rows.reduce((s, r) => s + (r.scheduled ? Math.max(0, (r.required ?? 0) - r.allocated) : 0), 0)
  );

  return {
    rows,
    totals: {
      allocated: allocatedTotal,
      unallocated: round2(Math.max(0, Math.max(0, budget) - allocatedTotal)),
      shortfall,
    },
  };
}
