import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useRecurringTasks } from '@/hooks/queries';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { getDueDateStatus, formatDueDate } from '@/utils/dashboardHelpers';
import type { TaskResponse } from '@/types/task.types';
import type { RecurringTaskResponse } from '@/types/recurring-task.types';

// ── Due date badge ────────────────────────────────────────────────────────

const DueDateBadge = React.memo(function DueDateBadge({ task }: { task: TaskResponse }) {
  if (!task.dueDate) return null;
  const status = getDueDateStatus(task.dueDate, task.isCompleted);
  if (status === 'none') return null;

  const label = formatDueDate(task.dueDate);
  const cls =
    status === 'overdue'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : status === 'due-today'
        ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
});

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
      <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">Assigned to</span>
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
      <span className="text-xs text-muted-foreground">
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
        'rounded-lg border transition-colors',
        task.isCompleted
          ? 'border-border/50 bg-muted/20'
          : dueDateStatus === 'overdue'
            ? 'border-destructive/30 bg-destructive/5'
            : 'border-border bg-card'
      )}
    >
      {/* Collapsed row — click to expand */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => onToggleExpand(task._id)}
      >
        {/* Checkbox — hidden once task has been completed for >24h */}
        {!pastOneDay && (
          <>
            {task.isCompleted && !canUndo ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary bg-primary">
                <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : (
              <span
                role="checkbox"
                aria-checked={task.isCompleted}
                onClick={handleToggleComplete}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  task.isCompleted
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/40 hover:border-primary',
                  completePending && 'opacity-50 pointer-events-none'
                )}
              >
                {completePending ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin text-primary-foreground" />
                ) : task.isCompleted ? (
                  <svg
                    className="h-2.5 w-2.5 text-primary-foreground"
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
            'flex-1 text-sm font-medium leading-tight truncate',
            task.isCompleted && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </span>

        {/* Due date badge */}
        {!task.isCompleted && <DueDateBadge task={task} />}

        {/* Assigned badge */}
        {task.assignedToNickname && !task.isCompleted && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {task.assignedToNickname}
          </span>
        )}

        {/* Completed badge */}
        {task.isCompleted && task.completedByNickname && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 text-[10px] font-medium">
            Done by {task.completedByNickname}
          </span>
        )}

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="border-t border-border/60 bg-muted/10 px-4 pb-4 pt-3 space-y-4">

          {/* Notes */}
          {task.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Notes</p>
              <p className="text-sm">{task.notes}</p>
            </div>
          )}

          {/* Due date with relative label */}
          {task.dueDate && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Due date</p>
              <p
                className={cn(
                  'text-sm font-medium',
                  dueDateStatus === 'overdue' && !task.isCompleted && 'text-destructive',
                  dueDateStatus === 'due-today' && !task.isCompleted && 'text-amber-600 dark:text-amber-400'
                )}
              >
                {formatDueDate(task.dueDate)}
              </p>
            </div>
          )}

          {/* Completion info */}
          {task.isCompleted && task.completedByNickname && (
            <div className="flex items-center gap-1.5 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2">
              <span className="text-xs text-green-700 dark:text-green-300">
                Completed by <strong>{task.completedByNickname}</strong>
                {task.completedAt &&
                  ` on ${new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </span>
            </div>
          )}

          {/* Assignment section */}
          {!task.isCompleted && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Assignment</p>
              {distribution === 'rotation' ? (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {rotationStatus
                      ? `Rotation — currently: ${rotationStatus.currentNickname}`
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
                  <span className="text-xs text-muted-foreground">
                    {task.assignedToNickname ? `Assigned to ${task.assignedToNickname}` : 'Unassigned'}
                  </span>
                )
              ) : (
                /* ai or other */
                <span className="text-xs text-muted-foreground">
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
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmingDelete(task._id)}
              >
                Delete task
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">
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
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{rt.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {rt.interval.charAt(0).toUpperCase() + rt.interval.slice(1)}
          {rt.assignedToNickname && ` · ${rt.assignedToNickname}`}
        </p>
      </div>
      {!confirmingDeactivate ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmingDeactivate(true)}
        >
          Deactivate
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-destructive">Remove?</span>
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
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Rotation not configured</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set the starting member and period to enable automatic rotation.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRotationConfigOpen(true)}
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Configure
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">
            This week: <span className="text-foreground">{rotationStatus.currentNickname}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Next: {rotationStatus.nextNickname} · {rotationStatus.periodDays}-day rotation
          </p>
        </div>
      </div>
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setRotationConfigOpen(true)}
        >
          <Settings2 className="mr-1 h-3 w-3" />
          Edit
        </Button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function TasksPage() {
  const {
    household,
    tasks,
    tasksLoading,
    taskLevel,
    distribution,
    setAddTaskOpen,
    setAddRecurringTaskOpen,
  } = useDashboard();

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);

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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage shared household responsibilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          {taskLevel === 'full' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddRecurringTaskOpen(true)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Recurring
            </Button>
          )}
          <Button size="sm" onClick={() => setAddTaskOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Rotation banner (only when distribution === 'rotation') */}
      {distribution === 'rotation' && <RotationBanner />}

      {/* Task list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Pending{pendingTasks.length > 0 && ` (${pendingTasks.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasksLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pendingTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="All caught up!"
              description="No pending tasks. Add a task to keep track of shared responsibilities."
              action={{ label: 'Add task', onClick: () => setAddTaskOpen(true) }}
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground italic">
                Tap any task to see details and available actions.
              </p>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">
              Completed ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground italic">
              Tap a completed task to mark it incomplete or delete it.
            </p>
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
          </CardContent>
        </Card>
      )}

      {/* Recurring templates */}
      {taskLevel === 'full' && (
        <Card>
          <button
            className="flex w-full items-center justify-between px-5 py-3 text-left"
            onClick={() => setRecurringOpen((o) => !o)}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recurring Templates</span>
              {recurringTasks.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {recurringTasks.length}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                recurringOpen && 'rotate-180'
              )}
            />
          </button>
          {recurringOpen && (
            <CardContent className="pt-0 space-y-2">
              {recurringLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                  <p className="text-xs text-muted-foreground pb-1">
                    These templates generate new tasks automatically. Deactivate to stop.
                  </p>
                  {recurringTasks.map((rt) => (
                    <RecurringTaskRow key={rt._id} rt={rt} />
                  ))}
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
