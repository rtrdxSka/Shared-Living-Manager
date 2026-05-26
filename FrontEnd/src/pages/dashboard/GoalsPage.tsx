import { useState } from 'react';
import { Loader2, Plus, Target, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useDashboard } from '@/contexts/useDashboard';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { MoneyAmount } from '@/components/ui/money-amount';
import { fmt, computeGoalProgress } from '@/utils/dashboardHelpers';
import {
  contributionsByMember,
  forecastFinishDate,
  requiredMonthlyContribution,
  splitContribution,
  type SplitContext,
  type ForecastStatus,
} from '@/utils/goalPlanner';
import TogetherProgressBar from '@/components/dashboard/couple/TogetherProgressBar';
import SavingsPlanCard from '@/components/dashboard/couple/SavingsPlanCard';
import type { GoalResponse, GoalPriority } from '@/types/goal.types';

// ── Category emoji map ────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  savings:   '💰',
  travel:    '✈️',
  home:      '🏠',
  emergency: '🚨',
  other:     '🎯',
};

function goalEmoji(category?: string): string {
  return (category ? CATEGORY_EMOJI[category] : undefined) ?? '🎯';
}

// ── Deadline formatter ────────────────────────────────────────────────────

function formatDeadline(deadline?: string): string {
  if (!deadline) return '';
  return new Date(deadline).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatPlanDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// ── Forecast chip (couple mode) ───────────────────────────────────────────

const FORECAST_CHIP: Record<Exclude<ForecastStatus, 'unknown'>, { label: string; className: string }> = {
  ahead: { label: 'Ahead of pace', className: 'bg-pos/15 text-pos' },
  'on-track': { label: 'On track', className: 'bg-pos/15 text-pos' },
  behind: { label: 'Behind pace', className: 'bg-warn/20 text-warn' },
};

function ForecastChip({ status }: { status: ForecastStatus }) {
  if (status === 'unknown') return null;
  const chip = FORECAST_CHIP[status];
  return (
    <span
      className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', chip.className)}
      data-testid="goal-forecast-chip"
    >
      {chip.label}
    </span>
  );
}

// ── Priority selector (couple mode) ───────────────────────────────────────

const PRIORITY_OPTIONS: { value: GoalPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

function PrioritySelector({
  value,
  onChange,
}: {
  value: GoalPriority;
  onChange: (p: GoalPriority) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-2" data-testid="goal-priority-selector">
      <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
        Priority
      </span>
      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {PRIORITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={cn(
              'px-2.5 py-1 text-xs transition-colors',
              value === opt.value
                ? 'bg-accent text-accent-ink'
                : 'bg-transparent text-ink-2 hover:bg-surface-2'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Goal card (new design) ────────────────────────────────────────────────

interface GoalCardProps {
  goal: GoalResponse;
  confirmingDelete: string | null;
  setConfirmingDelete: (id: string | null) => void;
}

function GoalCard({ goal, confirmingDelete, setConfirmingDelete }: GoalCardProps) {
  const {
    currency,
    currentUserId,
    uiMode,
    myMemberId,
    myNickname,
    partnerNickname,
    splitMethod,
    incomeSplit,
    customMyPct,
    setContributionTarget,
    updateGoal,
    setGoalPriority,
    deleteGoal,
    removeContribution,
  } = useDashboard();

  const [statusPending, setStatusPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [contributionsOpen, setContributionsOpen] = useState(false);

  const { pct, capped, overflowAmount } = computeGoalProgress(
    goal.currentAmount,
    goal.targetAmount
  );

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isActive = goal.status === 'active';
  const isCompleted = goal.status === 'completed';
  const isConfirmingThisDelete = confirmingDelete === goal._id;

  // ── Couple "Together Fund" extras (no-op for roommate mode) ──────────────
  const isCouple = uiMode === 'couple';
  const splitCtx: SplitContext = { splitMethod, incomeSplit, customMyPct };
  const teamwork = contributionsByMember(goal, myMemberId);
  const now = new Date();
  const forecast = isCouple && isActive ? forecastFinishDate(goal, now) : null;
  const requiredMonthly =
    isCouple && isActive && remaining > 0
      ? requiredMonthlyContribution(remaining, goal.deadline, now)
      : null;
  const monthlySplit = requiredMonthly !== null ? splitContribution(requiredMonthly, splitCtx) : null;

  async function handleMarkCompleted() {
    setStatusPending(true);
    try {
      await updateGoal(goal._id, { status: 'completed' });
    } finally {
      setStatusPending(false);
    }
  }

  async function handleAbandon() {
    setStatusPending(true);
    try {
      await updateGoal(goal._id, { status: 'abandoned' });
    } finally {
      setStatusPending(false);
    }
  }

  async function handleDelete() {
    setDeletePending(true);
    try {
      await deleteGoal(goal._id);
    } finally {
      setDeletePending(false);
      setConfirmingDelete(null);
    }
  }

  async function handleRemoveContribution(contributionId: string) {
    await removeContribution(goal._id, contributionId);
  }

  return (
    <Card className={cn('p-5', !isActive && 'opacity-70')}>
      {/* Top row: emoji + forecast + deadline */}
      <div className="flex items-start gap-2">
        <span className="text-4xl leading-none">{goalEmoji(goal.category)}</span>
        <span className="flex-1" />
        {forecast && <ForecastChip status={forecast.status} />}
        {goal.deadline && (
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3">
            {formatDeadline(goal.deadline)}
          </span>
        )}
        {!isActive && (
          <span
            className={cn(
              'ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
              isCompleted
                ? 'bg-pos/15 text-pos'
                : 'bg-surface-2 text-ink-3'
            )}
          >
            {goal.status}
          </span>
        )}
      </div>

      {/* Goal name */}
      <h3 className="text-base font-semibold text-ink mt-3">{goal.name}</h3>

      {/* Saved amount */}
      <MoneyAmount amount={goal.currentAmount} currency={currency} size="lg" />

      {/* "of target" sub */}
      <span className="text-sm text-ink-3">
        of {fmt(goal.targetAmount)} {currency}
      </span>

      {/* Progress bar — teamwork (couple) or flat (roommate) */}
      <div className="mt-3">
        {isCouple ? (
          <TogetherProgressBar
            mine={teamwork.mine}
            partner={teamwork.partner}
            myLabel={myNickname}
            partnerLabel={partnerNickname}
            target={goal.targetAmount}
            currency={currency}
          />
        ) : (
          <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${capped}%` }}
            />
          </div>
        )}
      </div>

      {/* Footer: pct + remaining/overflow */}
      <div className="flex items-center justify-between gap-2 text-xs text-ink-3 mt-2">
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span>Saved {pct}% of target</span>
          {overflowAmount > 0 && (
            <span className="text-[10px] text-ink-3/80 truncate">
              over by {fmt(overflowAmount)} {currency}
            </span>
          )}
        </span>
        {overflowAmount === 0 ? (
          <span className="shrink-0">{fmt(remaining)} {currency} to go</span>
        ) : null}
      </div>

      {/* Couple savings-plan line (active goals with a deadline) */}
      {monthlySplit && requiredMonthly !== null && goal.deadline && (
        <p
          className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2"
          data-testid="goal-plan-line"
        >
          To reach this by{' '}
          <span className="font-medium text-ink">{formatPlanDeadline(goal.deadline)}</span>, save{' '}
          <span className="font-medium text-ink">{fmt(requiredMonthly)} {currency}/mo</span>{' '}
          together — {myNickname} {fmt(monthlySplit.mine)} · {partnerNickname}{' '}
          {fmt(monthlySplit.partner)}
        </p>
      )}

      {/* Priority selector — drives the savings-plan allocator (couple, active) */}
      {isCouple && isActive && (
        <PrioritySelector
          value={goal.priority}
          onChange={(p) => void setGoalPriority(goal._id, p)}
        />
      )}

      {/* Add contribution ghost button (active goals only) */}
      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setContributionTarget(goal)}
        >
          + Add contribution
        </Button>
      )}

      {/* Contributions list (collapsible) */}
      {goal.contributions.length > 0 && (
        <div className="mt-3">
          <button
            className="text-xs text-ink-3 hover:text-ink transition-colors"
            onClick={() => setContributionsOpen((o) => !o)}
          >
            {contributionsOpen ? 'Hide' : 'Show'} contributions ({goal.contributions.length})
          </button>
          {contributionsOpen && (
            <div className="mt-2 space-y-1.5">
              {goal.contributions.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-ink">{c.memberNickname}</span>
                    {c.note && (
                      <span className="ml-1.5 text-xs text-ink-3">— {c.note}</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-ink shrink-0">
                    +{fmt(c.amount)} {currency}
                  </span>
                  <button
                    onClick={() => void handleRemoveContribution(c._id)}
                    className="ml-1 text-ink-3 hover:text-neg transition-colors"
                    aria-label="Remove contribution"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Additional actions */}
      {(isActive || goal.createdByUserId === currentUserId) && (
        <>
          <Separator className="mt-4 mb-3" />
          <div className="flex flex-wrap items-center gap-2">
            {/* Description */}
            {goal.description && (
              <span className="text-xs text-ink-3 flex-1 min-w-0 truncate">{goal.description}</span>
            )}

            {/* Mark as completed */}
            {isActive && pct >= 100 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkCompleted}
                disabled={statusPending}
              >
                {statusPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Mark completed'
                )}
              </Button>
            )}

            {/* Abandon */}
            {isActive && goal.createdByUserId === currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-ink-3 hover:text-neg"
                onClick={handleAbandon}
                disabled={statusPending}
              >
                {statusPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Abandon'}
              </Button>
            )}

            {/* Delete — two-step */}
            {goal.createdByUserId === currentUserId && (
              <>
                {!isConfirmingThisDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-neg hover:text-neg hover:bg-neg/10"
                    onClick={() => setConfirmingDelete(goal._id)}
                  >
                    Delete
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neg font-medium">Delete permanently?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deletePending}
                    >
                      {deletePending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Yes, delete'
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDelete(null)}
                      disabled={deletePending}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Dashed "+ add goal" placeholder card ──────────────────────────────────

function AddGoalPlaceholder({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-dashed border-line hover:border-line-2 bg-transparent flex flex-col items-center justify-center text-ink-3 hover:text-ink p-8 transition-colors"
    >
      <Plus className="h-6 w-6 mb-2" />
      <span className="text-sm font-medium">Add goal</span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const {
    goals,
    goalsLoading,
    setAddGoalOpen,
    uiMode,
    currency,
    myNickname,
    partnerNickname,
    splitMethod,
    incomeSplit,
    customMyPct,
    savingsBudget,
    commitSavingsBudget,
  } = useDashboard();

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const isCouple = uiMode === 'couple';
  const splitCtx: SplitContext = { splitMethod, incomeSplit, customMyPct };
  const incomeIncomplete = splitMethod === 'income_based' && incomeSplit === null;

  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');
  const abandonedGoals = goals.filter((g) => g.status === 'abandoned');

  const headerSubtitle = `${activeGoals.length} active · ${completedGoals.length} completed`;

  return (
    <div className="min-h-screen bg-bg">
      <DashboardHeader
        title="Goals"
        subtitle={headerSubtitle}
        rightSlot={
          <Button size="sm" onClick={() => setAddGoalOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Goal
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-8">
        {goalsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-ink-3" />
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Create your first shared goal to get started."
            action={{ label: 'Add goal', onClick: () => setAddGoalOpen(true) }}
          />
        ) : (
          <>
            {/* ── Together Fund: monthly savings plan (couple mode) ─────── */}
            {isCouple && (
              <SavingsPlanCard
                goals={goals}
                splitCtx={splitCtx}
                currency={currency}
                myLabel={myNickname}
                partnerLabel={partnerNickname}
                budget={savingsBudget}
                onBudgetCommit={(n) => void commitSavingsBudget(n)}
                incomeIncomplete={incomeIncomplete}
              />
            )}

            {/* ── Active goals ──────────────────────────────────────────── */}
            <section>
              <EyebrowLabel as="div" className="mb-4 block">ACTIVE GOALS</EyebrowLabel>
              {activeGoals.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AddGoalPlaceholder onClick={() => setAddGoalOpen(true)} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeGoals.map((goal) => (
                    <GoalCard
                      key={goal._id}
                      goal={goal}
                      confirmingDelete={confirmingDelete}
                      setConfirmingDelete={setConfirmingDelete}
                    />
                  ))}
                  <AddGoalPlaceholder onClick={() => setAddGoalOpen(true)} />
                </div>
              )}
            </section>

            {/* ── Completed goals ───────────────────────────────────────── */}
            {completedGoals.length > 0 && (
              <section>
                <EyebrowLabel as="div" className="mb-4 block">COMPLETED</EyebrowLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedGoals.map((goal) => (
                    <GoalCard
                      key={goal._id}
                      goal={goal}
                      confirmingDelete={confirmingDelete}
                      setConfirmingDelete={setConfirmingDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Abandoned goals ───────────────────────────────────────── */}
            {abandonedGoals.length > 0 && (
              <section>
                <EyebrowLabel as="div" className="mb-4 block">ABANDONED</EyebrowLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {abandonedGoals.map((goal) => (
                    <GoalCard
                      key={goal._id}
                      goal={goal}
                      confirmingDelete={confirmingDelete}
                      setConfirmingDelete={setConfirmingDelete}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
