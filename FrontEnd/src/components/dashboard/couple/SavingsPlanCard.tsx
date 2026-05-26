import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { fmt } from '@/utils/dashboardHelpers';
import { allocateMonthlyBudget, type SplitContext, type AllocationStatus } from '@/utils/goalPlanner';
import type { GoalResponse, GoalPriority } from '@/types/goal.types';

interface Props {
  goals: GoalResponse[];
  splitCtx: SplitContext;
  currency: string;
  myLabel: string;
  partnerLabel: string;
  /** Persisted monthly budget (0 when unset). */
  budget: number;
  /** Persist a new budget (any member); called on blur / Enter. */
  onBudgetCommit: (monthlySavingsBudget: number) => void;
  /** True when income_based but income data is incomplete → 50/50 fallback. */
  incomeIncomplete: boolean;
  /** Injectable for deterministic tests. */
  now?: Date;
}

const STATUS_CHIP: Record<AllocationStatus, { label: string; className: string }> = {
  funded: { label: 'On plan', className: 'bg-pos/15 text-pos' },
  underfunded: { label: 'Partly on plan', className: 'bg-warn/20 text-warn' },
  unfunded: { label: 'Not in plan yet', className: 'bg-surface-2 text-ink-3' },
  unscheduled: { label: 'No deadline', className: 'bg-surface-2 text-ink-3' },
};

// Priority badge on each plan row, so the funding order is self-explaining.
// Normal is the default and shows nothing, to keep the rows quiet.
const PRIORITY_BADGE: Partial<Record<GoalPriority, { label: string; className: string }>> = {
  high: { label: 'High', className: 'bg-accent/15 text-accent' },
  low: { label: 'Low', className: 'bg-surface-2 text-ink-3' },
};

/**
 * Couple-only "Monthly savings plan": the couple enters what they can save each
 * month and the app allocates it across their active goals (priority, then
 * deadline), showing each partner's share. The budget is persisted to the
 * household via `onBudgetCommit`, so both partners share one plan.
 */
export default function SavingsPlanCard({
  goals,
  splitCtx,
  currency,
  myLabel,
  partnerLabel,
  budget,
  onBudgetCommit,
  incomeIncomplete,
  now,
}: Props) {
  // Local draft so typing is smooth and the allocation previews live; the value
  // is persisted on blur/Enter. Re-sync when the saved budget changes elsewhere
  // (e.g. the partner edits it).
  const [draft, setDraft] = useState(budget > 0 ? String(budget) : '');
  const [prevBudget, setPrevBudget] = useState(budget);
  if (prevBudget !== budget) {
    setPrevBudget(budget);
    setDraft(budget > 0 ? String(budget) : '');
  }

  const budgetNum = parseFloat(draft) || 0;

  const allocation = useMemo(
    () => allocateMonthlyBudget(budgetNum, goals, splitCtx, now ?? new Date()),
    [budgetNum, goals, splitCtx, now]
  );

  function commitBudget() {
    onBudgetCommit(parseFloat(draft) || 0);
  }

  const hasPlannableGoals = allocation.rows.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Monthly savings plan</CardTitle>
        <p className="text-sm text-ink-3">
          A plan, not money saved yet — what you two can set aside each month, split across your
          goals highest priority first.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="savings-budget"
            className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3"
          >
            We can save / month ({currency})
          </label>
          <Input
            id="savings-budget"
            data-testid="savings-budget-input"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitBudget}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitBudget();
                e.currentTarget.blur();
              }
            }}
            placeholder="e.g. 400"
            className="max-w-[200px]"
          />
        </div>

        {!hasPlannableGoals ? (
          <p className="py-2 text-sm text-ink-3">
            No active goals to plan for yet. Add a goal with a deadline and it&apos;ll show up here.
          </p>
        ) : (
          <>
            <p className="text-xs text-ink-3" data-testid="plan-order-caption">
              Funded top to bottom — priority first, then soonest deadline.
            </p>
            <div className="flex flex-col divide-y divide-line">
              {allocation.rows.map((row) => {
                const chip = STATUS_CHIP[row.status];
                const priorityBadge = PRIORITY_BADGE[row.priority];
                return (
                  <div
                    key={row.goalId}
                    data-testid={`plan-row-${row.goalId}`}
                    className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">{row.name}</span>
                        {priorityBadge && (
                          <span
                            data-testid={`plan-priority-${row.goalId}`}
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              priorityBadge.className
                            )}
                          >
                            {priorityBadge.label}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          chip.className
                        )}
                      >
                        {chip.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-ink-3">
                      {row.required !== null && (
                        <span>needs {fmt(row.required)} {currency}/mo</span>
                      )}
                      <span className="text-ink">
                        plan sets aside {fmt(row.allocated)} {currency}
                      </span>
                      {row.allocated > 0 && (
                        <span>
                          {myLabel} {fmt(row.mine)} · {partnerLabel} {fmt(row.partner)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-xs">
              <span className="text-ink-3">
                Allocated{' '}
                <span data-testid="plan-total-allocated" className="font-semibold text-ink">
                  {fmt(allocation.totals.allocated)} {currency}
                </span>
              </span>
              {allocation.totals.unallocated > 0 && (
                <span className="text-ink-3">
                  Unallocated{' '}
                  <span data-testid="plan-total-unallocated" className="font-semibold text-ink">
                    {fmt(allocation.totals.unallocated)} {currency}
                  </span>
                </span>
              )}
              {allocation.totals.shortfall > 0 && (
                <span className="text-ink-3">
                  Short of targets{' '}
                  <span data-testid="plan-total-shortfall" className="font-semibold text-warn">
                    {fmt(allocation.totals.shortfall)} {currency}
                  </span>
                </span>
              )}
            </div>
          </>
        )}

        {incomeIncomplete && (
          <p data-testid="plan-income-note" className="text-xs text-ink-3">
            Income data is incomplete, so contributions are split 50/50 for now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
