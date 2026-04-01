import { useState } from 'react';
import { ChevronDown, Loader2, Plus, Target, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useDashboard } from '@/contexts/DashboardContext';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { fmt, GOAL_CATEGORY_CHIP } from '@/utils/dashboardHelpers';
import type { GoalResponse } from '@/types/goal.types';
import type { GoalStatus } from '@/types/goal.types';

// ── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          clamped >= 100 ? 'bg-green-500' : 'bg-primary'
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ── Status filter pills ───────────────────────────────────────────────────

type StatusFilter = 'all' | GoalStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

// ── Goal card ────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: GoalResponse;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  confirmingDelete: string | null;
  setConfirmingDelete: (id: string | null) => void;
}

function GoalCard({
  goal,
  isExpanded,
  onToggleExpand,
  confirmingDelete,
  setConfirmingDelete,
}: GoalCardProps) {
  const {
    currency,
    currentUserId,
    setContributionTarget,
    updateGoal,
    deleteGoal,
    removeContribution,
  } = useDashboard();

  const [statusPending, setStatusPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const pct = goal.targetAmount > 0
    ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
    : 0;

  const isActive = goal.status === 'active';
  const isCompleted = goal.status === 'completed';
  const isConfirmingThisDelete = confirmingDelete === goal._id;

  const chipClass = goal.category
    ? (GOAL_CATEGORY_CHIP[goal.category] ?? GOAL_CATEGORY_CHIP.other)
    : GOAL_CATEGORY_CHIP.other;

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
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isCompleted
          ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
          : goal.status === 'abandoned'
            ? 'border-border/50 bg-muted/10 opacity-70'
            : 'border-border bg-card'
      )}
    >
      {/* Collapsed summary — click to expand */}
      <button
        className="flex w-full items-start gap-3 px-4 py-4 text-left"
        onClick={() => onToggleExpand(goal._id)}
      >
        {/* Category chip */}
        {goal.category && (
          <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${chipClass}`}>
            {goal.category}
          </span>
        )}

        {/* Name + progress */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className={cn('text-sm font-semibold leading-tight truncate', !isActive && 'text-muted-foreground')}>
            {goal.name}
          </p>
          <ProgressBar pct={pct} />
          <p className="text-xs text-muted-foreground">
            {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)} {currency}
            {' · '}
            <span className={cn('font-medium', pct >= 100 ? 'text-green-600 dark:text-green-400' : 'text-foreground')}>
              {pct}%
            </span>
          </p>
        </div>

        {/* Status badge */}
        {!isActive && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
              isCompleted
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {goal.status}
          </span>
        )}

        {/* Deadline */}
        {goal.deadline && isActive && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            by {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </span>
        )}

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="border-t border-border/60 bg-muted/10 px-4 pb-4 pt-3 space-y-4">

          {/* Description */}
          {goal.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Description</p>
              <p className="text-sm">{goal.description}</p>
            </div>
          )}

          {/* Deadline */}
          {goal.deadline && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Target deadline</p>
              <p className="text-sm">
                {new Date(goal.deadline).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </p>
            </div>
          )}

          {/* Contributions list */}
          {goal.contributions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Contributions ({goal.contributions.length})
              </p>
              <div className="space-y-1.5">
                {goal.contributions.map((c) => (
                  <div
                    key={c._id}
                    className="flex items-center justify-between gap-2 rounded-md bg-background border border-border/50 px-3 py-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{c.memberNickname}</span>
                      {c.note && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          — {c.note}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground shrink-0">
                      +{fmt(c.amount)} {currency}
                    </span>
                    <button
                      onClick={() => void handleRemoveContribution(c._id)}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove contribution"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Add contribution — active goals only */}
            {isActive && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setContributionTarget(goal)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add contribution
              </Button>
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
                  'Mark as completed'
                )}
              </Button>
            )}

            {/* Abandon — active only, admin / creator */}
            {isActive && (goal.createdByUserId === currentUserId) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleAbandon}
                disabled={statusPending}
              >
                {statusPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Abandon goal'}
              </Button>
            )}

            {/* Delete — two-step confirmation */}
            {goal.createdByUserId === currentUserId && (
              <>
                {!isConfirmingThisDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmingDelete(goal._id)}
                  >
                    Delete goal
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive font-medium">
                      Delete permanently?
                    </span>
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
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { goals, goalsLoading, setAddGoalOpen } = useDashboard();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedGoalId((prev) => (prev === id ? null : id));
    setConfirmingDelete(null);
  }

  const displayedGoals =
    statusFilter === 'all' ? goals : goals.filter((g) => g.status === statusFilter);

  const activeCount = goals.filter((g) => g.status === 'active').length;
  const totalSaved = goals
    .filter((g) => g.status === 'active')
    .reduce((sum, g) => sum + g.currentAmount, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Goals</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track shared savings and financial goals
          </p>
        </div>
        <Button size="sm" onClick={() => setAddGoalOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {/* Summary stats */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Active goals</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">{activeCount}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total saved</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">{fmt(totalSaved)}</p>
          </Card>
        </div>
      )}

      {/* Goals list */}
      <Card>
        <CardHeader className="pb-3">
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {goalsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayedGoals.length === 0 ? (
            <EmptyState
              icon={Target}
              title={statusFilter === 'all' ? 'No goals yet' : `No ${statusFilter} goals`}
              description={
                statusFilter === 'active'
                  ? 'Set a shared savings goal to work towards together.'
                  : statusFilter === 'all'
                    ? 'Create your first shared goal to get started.'
                    : `No ${statusFilter} goals to display.`
              }
              action={
                statusFilter !== 'abandoned'
                  ? { label: 'Add goal', onClick: () => setAddGoalOpen(true) }
                  : undefined
              }
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground italic">
                Tap any goal to see details, add contributions, and manage it.
              </p>
              <div className="space-y-3">
                {displayedGoals.map((goal) => (
                  <GoalCard
                    key={goal._id}
                    goal={goal}
                    isExpanded={expandedGoalId === goal._id}
                    onToggleExpand={toggleExpand}
                    confirmingDelete={confirmingDelete}
                    setConfirmingDelete={setConfirmingDelete}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
