import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckSquare,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardWarm } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboard } from '@/contexts/DashboardContext';
import { useRecurringTasks, useTasks } from '@/hooks/queries';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { Avatar } from '@/components/ui/avatar';
import { getDueDateStatus, formatDueDate } from '@/utils/dashboardHelpers';
import type { TaskResponse } from '@/types/task.types';
import type { RecurringTaskResponse } from '@/types/recurring-task.types';

// ── Assign select (fixed distribution) ───────────────────────────────────

interface AssignSelectProps {
  task: TaskResponse;
  taskMembers: { _id: string; nickname: string }[];
  onAssign: (taskId: string, memberId: string | null) => Promise<void>;
}

function AssignSelect({ task, taskMembers, onAssign }: AssignSelectProps) {
  const [pending, setPending] = useState(false);

  async function handleChange(value: string) {
    setPending(true);
    try {
      await onAssign(task._id, value === 'none' ? null : value);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <UserCheck className="h-3.5 w-3.5 text-ink-3 shrink-0" />
      <span className="text-xs text-ink-3">Assigned to</span>
      <Select
        value={task.assignedToMemberId ?? 'none'}
        onValueChange={handleChange}
        disabled={pending}
      >
        <SelectTrigger className="h-7 w-[140px] text-xs">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" className="text-xs">
            Unassigned
          </SelectItem>
          {taskMembers.map((m) => (
            <SelectItem key={m._id} value={m._id} className="text-xs">
              {m.nickname}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Claim / unclaim button (voluntary distribution) ───────────────────────

interface ClaimButtonProps {
  task: TaskResponse;
  myMemberId: string;
  myNickname: string;
  onAssign: (taskId: string, memberId: string | null) => Promise<void>;
}

function ClaimButton({ task, myMemberId, myNickname, onAssign }: ClaimButtonProps) {
  const [pending, setPending] = useState(false);
  const isAssignedToMe = task.assignedToMemberId === myMemberId;
  const isAssignedToOther = task.assignedToMemberId && !isAssignedToMe;

  async function handle() {
    setPending(true);
    try {
      await onAssign(task._id, isAssignedToMe ? null : myMemberId);
    } finally {
      setPending(false);
    }
  }

  if (isAssignedToOther) {
    return (
      <span className="text-xs text-ink-3">
        Claimed by {task.assignedToNickname}
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={handle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isAssignedToMe ? (
        `Unclaim (assigned to ${myNickname})`
      ) : (
        'Claim this task'
      )}
    </Button>
  );
}

// ── Task row (collapsed + expanded) ──────────────────────────────────────

interface TaskRowProps {
  task: TaskResponse;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  confirmingDelete: string | null;
  setConfirmingDelete: (id: string | null) => void;
}

const TaskRow = React.memo(function TaskRow({
  task,
  isExpanded,
  onToggleExpand,
  confirmingDelete,
  setConfirmingDelete,
}: TaskRowProps) {
  const {
    myMemberId,
    isAdmin,
    myNickname,
    currentUserId,
    distribution,
    taskMembers,
    rotationStatus,
    toggleTaskComplete,
    deleteTask,
    assignTask,
  } = useDashboard();

  const [completePending, setCompletePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const dueDateStatus = useMemo(
    () => getDueDateStatus(task.dueDate, task.isCompleted),
    [task.dueDate, task.isCompleted]
  );
  const isConfirmingThisDelete = confirmingDelete === task._id;
  const isOverdue = dueDateStatus === 'overdue';
  const isToday = dueDateStatus === 'due-today';

  const pastOneDay = useMemo(
    () =>
      task.isCompleted &&
      task.completedAt != null &&
      Date.now() - new Date(task.completedAt).getTime() >= 86_400_000,
    [task.isCompleted, task.completedAt]
  );

  const canUndo = useMemo(
    () =>
      !task.isCompleted ||
      (!pastOneDay &&
        (isAdmin ||
          (task.completedByMemberId === myMemberId && task.completedAt != null))),
    [task.isCompleted, task.completedByMemberId, task.completedAt, pastOneDay, isAdmin, myMemberId]
  );

  const canReassign = isAdmin || task.createdByUserId === currentUserId;

  async function handleToggleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    setCompletePending(true);
    try {
      await toggleTaskComplete(task._id);
    } finally {
      setCompletePending(false);
    }
  }

  async function handleDelete() {
    setDeletePending(true);
    try {
      await deleteTask(task._id);
    } finally {
      setDeletePending(false);
      setConfirmingDelete(null);
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        task.isCompleted
          ? 'border-line bg-surface'
          : isOverdue
            ? 'border-neg/40 bg-neg-bg/30'
            : 'border-line bg-surface hover:border-line-2'
      )}
    >
      {/* Collapsed row — click to expand */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => onToggleExpand(task._id)}
      >
        {/* Checkbox */}
        {!pastOneDay && (
          <>
            {task.isCompleted && !canUndo ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-accent bg-accent">
                <svg className="h-3 w-3 text-accent-ink" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : (
              <span
                role="checkbox"
                aria-checked={task.isCompleted}
                onClick={handleToggleComplete}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                  task.isCompleted
                    ? 'border-accent bg-accent'
                    : 'border-line hover:border-accent',
                  completePending && 'opacity-50 pointer-events-none'
                )}
              >
                {completePending ? (
                  <Loader2 className="h-3 w-3 animate-spin text-accent-ink" />
                ) : task.isCompleted ? (
                  <svg
                    className="h-3 w-3 text-accent-ink"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
            )}
          </>
        )}

        {/* Title */}
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-sm text-ink',
            task.isCompleted && 'line-through text-ink-3'
          )}
        >
          {task.title}
        </span>

        {/* Due date label */}
        {!task.isCompleted && task.dueDate && dueDateStatus !== 'none' && (
          <span
            className={cn(
              'text-xs shrink-0',
              isOverdue ? 'text-neg' : isToday ? 'text-warn' : 'text-ink-3'
            )}
          >
            {formatDueDate(task.dueDate)}
          </span>
        )}

        {/* Completed by */}
        {task.isCompleted && task.completedByNickname && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-3">
            Done by {task.completedByNickname}
          </span>
        )}

        {/* Assignee avatar or "Up for grabs" pill */}
        {!task.isCompleted && (
          task.assignedToNickname ? (
            <Avatar name={task.assignedToNickname} size={24} />
          ) : (
            <span className="rounded-full bg-accent/20 text-accent-ink px-2 py-0.5 text-[10px] font-medium shrink-0">
              Up for grabs
            </span>
          )
        )}

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="border-t border-line/60 bg-surface-2/40 px-4 pb-4 pt-3 space-y-4">

          {/* Notes */}
          {task.notes && (
            <div>
              <p className="text-xs font-medium text-ink-3 mb-0.5">Notes</p>
              <p className="text-sm text-ink">{task.notes}</p>
            </div>
          )}

          {/* Due date with relative label */}
          {task.dueDate && (
            <div>
              <p className="text-xs font-medium text-ink-3 mb-0.5">Due date</p>
              <p
                className={cn(
                  'text-sm font-medium',
                  isOverdue && !task.isCompleted && 'text-neg',
                  isToday && !task.isCompleted && 'text-warn'
                )}
              >
                {formatDueDate(task.dueDate)}
              </p>
            </div>
          )}

          {/* Completion info */}
          {task.isCompleted && task.completedByNickname && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface border border-line px-3 py-2">
              <span className="text-xs text-ink-3">
                Completed by <strong className="text-ink">{task.completedByNickname}</strong>
                {task.completedAt &&
                  ` on ${new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </span>
            </div>
          )}

          {/* Assignment section */}
          {!task.isCompleted && (
            <div>
              <p className="text-xs font-medium text-ink-3 mb-1.5">Assignment</p>
              {distribution === 'rotation' ? (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-ink-3" />
                  <span className="text-xs text-ink-3">
                    {rotationStatus
                      ? `Rotation: ${rotationStatus.currentNickname}`
                      : task.assignedToNickname
                        ? `Assigned to ${task.assignedToNickname}`
                        : 'Rotation not configured yet'}
                  </span>
                </div>
              ) : distribution === 'voluntary' ? (
                <ClaimButton
                  task={task}
                  myMemberId={myMemberId}
                  myNickname={myNickname}
                  onAssign={assignTask}
                />
              ) : distribution === 'fixed' ? (
                canReassign ? (
                  <AssignSelect
                    task={task}
                    taskMembers={taskMembers}
                    onAssign={assignTask}
                  />
                ) : (
                  <span className="text-xs text-ink-3">
                    {task.assignedToNickname ? `Assigned to ${task.assignedToNickname}` : 'Unassigned'}
                  </span>
                )
              ) : (
                /* ai or other */
                <span className="text-xs text-ink-3">
                  {task.assignedToNickname
                    ? `Assigned to ${task.assignedToNickname}`
                    : 'Unassigned'}
                </span>
              )}
            </div>
          )}

          <Separator />

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mark done / incomplete — "Mark as incomplete" hidden once past 24h */}
            {(!task.isCompleted || !pastOneDay) && (
              <Button
                variant={task.isCompleted ? 'outline' : 'default'}
                size="sm"
                onClick={handleToggleComplete}
                disabled={completePending || (task.isCompleted && !canUndo)}
              >
                {completePending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : task.isCompleted ? (
                  'Mark as incomplete'
                ) : (
                  'Mark as done'
                )}
              </Button>
            )}

            {/* Delete — two-step inline confirmation */}
            {!isConfirmingThisDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-neg hover:text-neg hover:bg-neg-bg/40"
                onClick={() => setConfirmingDelete(task._id)}
              >
                Delete task
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neg font-medium">
                  Delete this task?
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
          </div>
        </div>
      )}
    </div>
  );
});

// ── Recurring task row ────────────────────────────────────────────────────

function RecurringTaskRow({ rt }: { rt: RecurringTaskResponse }) {
  const { deactivateRecurringTask } = useDashboard();
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDeactivate() {
    setPending(true);
    try {
      await deactivateRecurringTask(rt._id);
    } finally {
      setPending(false);
      setConfirmingDeactivate(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{rt.title}</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {rt.interval.charAt(0).toUpperCase() + rt.interval.slice(1)}
          {rt.assignedToNickname && ` · ${rt.assignedToNickname}`}
        </p>
      </div>
      {!confirmingDeactivate ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-ink-3 hover:text-neg"
          onClick={() => setConfirmingDeactivate(true)}
        >
          Deactivate
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-neg">Remove?</span>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={handleDeactivate}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setConfirmingDeactivate(false)}
            disabled={pending}
          >
            No
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Rotation banner ───────────────────────────────────────────────────────

function RotationBanner() {
  const { rotationStatus, isAdmin, setRotationConfigOpen } = useDashboard();

  if (!rotationStatus) {
    if (!isAdmin) return null;
    // No config — show subtle prompt
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-line bg-surface-2/60 px-5 py-4 mb-6">
        <div>
          <p className="text-sm font-medium text-ink">Set a rotation to share tasks fairly</p>
          <p className="text-xs text-ink-3 mt-0.5">
            Assign who leads the week automatically on a recurring cycle.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRotationConfigOpen(true)}
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Set rotation
        </Button>
      </div>
    );
  }

  const nextStartDay = new Date(rotationStatus.nextPeriodStartDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <CardWarm className="flex items-center gap-4 p-5 mb-6">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
        <RefreshCw className="h-5 w-5 text-accent" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <EyebrowLabel className="mb-1">ROTATION</EyebrowLabel>
        <p className="text-sm font-medium text-ink leading-snug">
          <em className="font-semibold italic font-serif text-accent">{rotationStatus.currentNickname}</em>
          {"'s week to lead the rotation"}
        </p>
        <p className="text-xs text-ink-3 mt-0.5">
          Next up: {rotationStatus.nextNickname} on {nextStartDay} · {rotationStatus.periodDays}-day cycle
        </p>
      </div>

      {/* Avatar arrow visualization */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <Avatar name={rotationStatus.currentNickname} size={36} />
        <ArrowRight className="h-4 w-4 text-ink-3" />
        <Avatar name={rotationStatus.nextNickname} size={36} variant="ghost" />
      </div>

      {/* Edit cycle button (admin only) */}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs shrink-0"
          onClick={() => setRotationConfigOpen(true)}
        >
          Edit cycle
        </Button>
      )}
    </CardWarm>
  );
}

// ── Fairness card (right rail) ────────────────────────────────────────────

function FairnessCard() {
  const { taskMembers, tasks } = useDashboard();

  // Recomputed each render so the 30-day window always reflects current time.
  const monthAgo = Date.now() - 30 * 86_400_000;

  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of taskMembers) counts[m._id] = 0;
    for (const t of tasks) {
      if (
        t.isCompleted &&
        t.completedByMemberId &&
        t.completedAt &&
        new Date(t.completedAt).getTime() >= monthAgo
      ) {
        counts[t.completedByMemberId] = (counts[t.completedByMemberId] ?? 0) + 1;
      }
    }
    return counts;
  // monthAgo changes on every render intentionally — stale reads are acceptable
  // because the 30-day window only shifts by milliseconds between renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskMembers, tasks]);

  const maxCount = Math.max(1, ...Object.values(memberCounts));

  return (
    <Card className="p-5">
      <EyebrowLabel as="div" className="mb-4">FAIRNESS THIS MONTH</EyebrowLabel>
      {taskMembers.length === 0 ? (
        <p className="text-xs text-ink-3">No task members found.</p>
      ) : (
        <div className="space-y-3">
          {taskMembers.map((m) => {
            const count = memberCounts[m._id] ?? 0;
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={m._id} className="flex items-center gap-3">
                <Avatar name={m.nickname} size={24} />
                <span className="text-sm text-ink w-20 truncate shrink-0">{m.nickname}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-ink-3 w-5 text-right shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Distribution method card (right rail) ─────────────────────────────────

function DistributionCard() {
  const { distribution } = useDashboard();

  const methodLabel: Record<string, string> = {
    rotation: 'Weekly rotation',
    voluntary: 'Voluntary claiming',
    fixed: 'Fixed assignment',
    ai: 'AI-balanced',
  };

  return (
    <Card className="p-5">
      <EyebrowLabel as="div" className="mb-3">DISTRIBUTION METHOD</EyebrowLabel>
      <p className="text-sm text-ink mb-3">
        Currently: <span className="font-medium">{methodLabel[distribution] ?? distribution}</span>
      </p>
    </Card>
  );
}

// ── Streak nudge card (right rail) ────────────────────────────────────────



// ── Main page ─────────────────────────────────────────────────────────────

export default function TasksPage() {
  const {
    household,
    tasks,
    tasksLoading,
    taskLevel,
    distribution,
    overdueCount,
    setAddTaskOpen,
    setAddRecurringTaskOpen,
  } = useDashboard();

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);

  // Re-subscribes to the same query the dashboard context uses (shared cache
  // via identical query key) so this page can drive fetchNextPage.
  const { hasNextPage, fetchNextPage, isFetchingNextPage } = useTasks(household._id);

  const { data: recurringTasksData, isLoading: recurringLoading } = useRecurringTasks(
    household._id,
    taskLevel === 'full'
  );
  const recurringTasks = recurringTasksData ?? [];

  function toggleExpand(id: string) {
    setExpandedTaskId((prev) => (prev === id ? null : id));
    setConfirmingDelete(null);
  }

  const { pendingTasks, completedTasks } = useMemo(() => {
    const pending: TaskResponse[] = [];
    const completed: TaskResponse[] = [];
    for (const t of tasks) {
      if (t.isCompleted) completed.push(t);
      else pending.push(t);
    }
    return { pendingTasks: pending, completedTasks: completed };
  }, [tasks]);

  const pendingCount = pendingTasks.length;

  return (
    <div>
      {/* Page header */}
      <DashboardHeader
        title="Tasks"
        subtitle={`${pendingCount} pending · ${overdueCount} overdue`}
      />

      <div className="p-4 sm:p-6">
        {/* Top control row */}
        <div className="flex items-center flex-wrap gap-3 mb-6">
          {taskLevel === 'full' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddRecurringTaskOpen(true)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Recurring tasks
            </Button>
          )}
          <Button size="sm" onClick={() => setAddTaskOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add task
          </Button>
        </div>

        {/* Rotation banner (only when distribution === 'rotation') */}
        {distribution === 'rotation' && <RotationBanner />}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-6">
            {/* Pending tasks section */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <EyebrowLabel>PENDING</EyebrowLabel>
                <span className="text-sm text-ink-3">{pendingCount} tasks</span>
              </div>

              {tasksLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-ink-3" />
                </div>
              ) : pendingTasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="All caught up!"
                  description="No pending tasks. Add a task to keep track of shared responsibilities."
                  action={{ label: 'Add task', onClick: () => setAddTaskOpen(true) }}
                />
              ) : (
                <div className="space-y-2">
                  {pendingTasks.map((task) => (
                    <TaskRow
                      key={task._id}
                      task={task}
                      isExpanded={expandedTaskId === task._id}
                      onToggleExpand={toggleExpand}
                      confirmingDelete={confirmingDelete}
                      setConfirmingDelete={setConfirmingDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Done this week section */}
            {completedTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <EyebrowLabel>DONE THIS WEEK</EyebrowLabel>
                  <span className="text-sm text-ink-3">{completedTasks.length} tasks</span>
                </div>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <TaskRow
                      key={task._id}
                      task={task}
                      isExpanded={expandedTaskId === task._id}
                      onToggleExpand={toggleExpand}
                      confirmingDelete={confirmingDelete}
                      setConfirmingDelete={setConfirmingDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Load-more footer */}
            {!tasksLoading && hasNextPage && (
              <div className="flex justify-center py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { void fetchNextPage(); }}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
            {!tasksLoading && !hasNextPage && tasks.length > 0 && (
              <p className="text-center text-xs text-ink-3 py-2">No more tasks.</p>
            )}

            {/* Recurring templates (full level only) */}
            {taskLevel === 'full' && (
              <div>
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-5 py-3 text-left hover:border-line-2 transition-colors"
                  onClick={() => setRecurringOpen((o) => !o)}
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-ink-3" />
                    <span className="text-sm font-medium text-ink">Recurring Templates</span>
                    {recurringTasks.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {recurringTasks.length}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-ink-3 transition-transform duration-200',
                      recurringOpen && 'rotate-180'
                    )}
                  />
                </button>
                {recurringOpen && (
                  <div className="mt-2 space-y-2">
                    {recurringLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-ink-3" />
                      </div>
                    ) : recurringTasks.length === 0 ? (
                      <EmptyState
                        icon={RefreshCw}
                        title="No recurring templates"
                        description="Create a recurring template to automatically generate tasks on a schedule."
                        action={{
                          label: 'Add recurring',
                          onClick: () => setAddRecurringTaskOpen(true),
                        }}
                      />
                    ) : (
                      <>
                        <p className="text-xs text-ink-3 pb-1">
                          These templates generate new tasks automatically. Deactivate to stop.
                        </p>
                        {recurringTasks.map((rt) => (
                          <RecurringTaskRow key={rt._id} rt={rt} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            <FairnessCard />
            <DistributionCard />
            
          </div>
        </div>
      </div>
    </div>
  );
}
