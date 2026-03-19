import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Loader2, Pencil, Trash2, RefreshCw, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { HouseholdResponse, HouseholdMemberResponse } from '@/types/household.types';
import type { ExpenseResponse } from '@/types/expense.types';
import type { RecurringExpenseResponse } from '@/types/recurring-expense.types';
import type { TaskResponse, RotationStatus } from '@/types/task.types';
import type { RecurringTaskResponse } from '@/types/recurring-task.types';
import type { ExpenseType } from '@/types/onboarding.types';
import { EXPENSE_TYPES } from '@/types/onboarding.types';
import type { GoalResponse, GoalStatus } from '@/types/goal.types';
import {
  useExpenses,
  useDeleteExpense,
  useClaimExpense,
  useResolveExpense,
  useRecurringExpenses,
  useDeactivateRecurringExpense,
  useTasks,
  useToggleTaskComplete,
  useDeleteTask,
  useAssignTask,
  useSetRotation,
  useRecurringTasks,
  useDeactivateRecurringTask,
  useGoals,
  useUpdateGoal,
  useDeleteGoal,
  useRemoveContribution,
  useUpdateSettings,
  useRecordSettlement,
} from '@/hooks/queries';
import IncomeEntryCard from '@/components/dashboard/shared/IncomeEntryCard';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import AddTaskForm from '@/components/dashboard/shared/AddTaskForm';
import AddGoalForm from '@/components/dashboard/shared/AddGoalForm';
import AddContributionDialog from '@/components/dashboard/shared/AddContributionDialog';
import AddRecurringTaskForm from '@/components/dashboard/shared/AddRecurringTaskForm';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Types ──────────────────────────────────────────────────────────────────

type FinanceMode = 'joint' | 'split';
type SplitMethod = 'equal' | 'income_based' | 'custom';
type TaskLevel = 'full' | 'basic' | 'disabled';
type DistributionMethod = 'rotation' | 'fixed' | 'voluntary';
type Tab = 'overview' | 'expenses' | 'tasks' | 'goals';

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_CURRENCY = 'лв';



// ── Helpers ────────────────────────────────────────────────────────────────

/** Derive the split percentages from household member income data. */
function deriveIncomeSplit(
  household: HouseholdResponse,
  currentUserId: string
): { myPct: number; partnerPct: number } | null {
  const financialMembers = household.members.filter((m) => m.participatesInFinances && m.userId);
  const allHaveIncome = financialMembers.every((m) => m.monthlyIncome !== undefined);
  if (!allHaveIncome || financialMembers.length === 0) return null;

  const total = financialMembers.reduce((s, m) => s + (m.monthlyIncome ?? 0), 0);
  if (total === 0) return null;

  const me = financialMembers.find((m) => m.userId === currentUserId);
  if (!me) return null;

  const myPct = Math.round(((me.monthlyIncome ?? 0) / total) * 100);
  return { myPct, partnerPct: 100 - myPct };
}

function getMyShareLabel(
  expense: ExpenseResponse,
  splitMethod: SplitMethod,
  customMyPct: number,
  incomeSplit: { myPct: number; partnerPct: number } | null,
  currency: string
): string {
  const { amount } = expense;
  if (splitMethod === 'equal') {
    return `Your share: ${(amount / 2).toFixed(2)} ${currency}`;
  }
  if (splitMethod === 'income_based' && incomeSplit) {
    const pct = incomeSplit.myPct;
    return `Your share: ${((amount * pct) / 100).toFixed(2)} ${currency} (${pct}%)`;
  }
  if (splitMethod === 'income_based') {
    return 'Income data incomplete';
  }
  return `Your share: ${((amount * customMyPct) / 100).toFixed(2)} ${currency} (${customMyPct}%)`;
}

function getBalanceSplitLabel(
  splitMethod: SplitMethod,
  customMyPct: number,
  incomeSplit: { myPct: number; partnerPct: number } | null
): string {
  if (splitMethod === 'equal') return '50/50 equal split';
  if (splitMethod === 'income_based' && incomeSplit) {
    return `${incomeSplit.myPct}/${incomeSplit.partnerPct} income-based split`;
  }
  if (splitMethod === 'income_based') return 'income-based split (data incomplete)';
  return `${customMyPct}/${100 - customMyPct} custom split`;
}

const CATEGORY_CHIP_CLASSES: Record<string, string> = {
  rent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  utilities: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  groceries: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  internet: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  cleaning: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  subscriptions: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function stepMonth(ym: string, dir: 'prev' | 'next'): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, dir === 'prev' ? m - 2 : m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type DueDateStatus = 'overdue' | 'due-today' | 'upcoming' | 'none';

function getDueDateStatus(dueDate: string | undefined, isCompleted: boolean): DueDateStatus {
  if (!dueDate || isCompleted) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - today.getTime();
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  return 'upcoming';
}

function formatDueDate(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === -1) return 'Due 1 day ago';
  if (diffDays > 1 && diffDays <= 6) return `Due in ${diffDays} days`;
  if (diffDays < -1) return `Due ${Math.abs(diffDays)} days ago`;
  return `Due ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'goals', label: 'Goals' },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-transparent hover:bg-muted'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {opt.label}
            {value === opt.value && ' ✓'}
          </button>
        ))}
      </div>
      {disabled && <span className="text-xs text-muted-foreground italic">Admin only</span>}
    </div>
  );
}

function MockControls({
  financeMode,
  setFinanceMode,
  splitMethod,
  setSplitMethod,
  taskLevel,
  setTaskLevel,
  distribution,
  setDistribution,
  isAdmin,
}: {
  financeMode: FinanceMode;
  setFinanceMode: (v: FinanceMode) => void;
  splitMethod: SplitMethod;
  setSplitMethod: (v: SplitMethod) => void;
  taskLevel: TaskLevel;
  setTaskLevel: (v: TaskLevel) => void;
  distribution: DistributionMethod;
  setDistribution: (v: DistributionMethod) => void;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        <span>Mock Controls</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          <ToggleGroup<FinanceMode>
            label="Finance Mode"
            options={[
              { value: 'joint', label: 'Joint' },
              { value: 'split', label: 'Split' },
            ]}
            value={financeMode}
            onChange={setFinanceMode}
            disabled={!isAdmin}
          />

          {financeMode === 'split' && (
            <ToggleGroup<SplitMethod>
              label="Split Method"
              options={[
                { value: 'equal', label: 'Equal' },
                { value: 'income_based', label: 'Income-based' },
                { value: 'custom', label: 'Custom' },
              ]}
              value={splitMethod}
              onChange={setSplitMethod}
              disabled={!isAdmin}
            />
          )}

          <ToggleGroup<TaskLevel>
            label="Task Level"
            options={[
              { value: 'full', label: 'Full' },
              { value: 'basic', label: 'Basic' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            value={taskLevel}
            onChange={setTaskLevel}
          />

          {taskLevel !== 'disabled' && (
            <ToggleGroup<DistributionMethod>
              label="Distribution"
              options={[
                { value: 'rotation', label: 'Rotation' },
                { value: 'fixed', label: 'Fixed' },
                { value: 'voluntary', label: 'Voluntary' },
              ]}
              value={distribution}
              onChange={setDistribution}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatsRow({
  financeMode,
  splitMethod,
  customMyPct,
  incomeSplit,
  myNickname,
  partnerNickname,
  currency,
  expenses,
  myPaidTotal,
  partnerPaidTotal,
  totalAmount,
  settlementForMonth,
  onSettleUp,
  myParticipatesInFinances,
  hasFinancialPartner,
}: {
  financeMode: FinanceMode;
  splitMethod: SplitMethod;
  customMyPct: number;
  incomeSplit: { myPct: number; partnerPct: number } | null;
  myNickname: string;
  partnerNickname: string;
  currency: string;
  expenses: ExpenseResponse[];
  myPaidTotal: number;
  partnerPaidTotal: number;
  totalAmount: number;
  settlementForMonth: { amount: number; settledAt: string } | null;
  onSettleUp: (amount: number) => Promise<void>;
  myParticipatesInFinances: boolean;
  hasFinancialPartner: boolean;
}) {
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [settlingUp, setSettlingUp] = useState(false);
  if (financeMode === 'joint') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {fmt(totalAmount)} {currency}
            </p>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Per Person</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ~{fmt(totalAmount / 2)} {currency}
            </p>
            <p className="text-xs text-muted-foreground">each</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{expenses.length}</p>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Split mode — guard: if user is not a financial member or has no financial partner,
  // show a neutral two-card view instead of the balance card
  if (!myParticipatesInFinances || !hasFinancialPartner) {
    const note = !myParticipatesInFinances
      ? 'You are not part of the shared finances.'
      : 'No financial partner found.';
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {fmt(totalAmount)} {currency}
            </p>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{expenses.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Split mode — balance uses only unresolved paid expenses
  const unresolvedPaid = expenses.filter((e) => e.paidByUserId && !e.isResolved);
  const unresolvedTotal = unresolvedPaid.reduce((s, e) => s + e.amount, 0);
  const myUnresolvedPaid = unresolvedPaid
    .filter((e) => e.paidByNickname === myNickname)
    .reduce((s, e) => s + e.amount, 0);
  let myShare: number;
  if (splitMethod === 'equal') {
    myShare = unresolvedTotal * 0.5;
  } else if (splitMethod === 'income_based' && incomeSplit) {
    myShare = unresolvedTotal * (incomeSplit.myPct / 100);
  } else {
    myShare = unresolvedTotal * (customMyPct / 100);
  }
  const balance = myUnresolvedPaid - myShare;
  const balancePositive = balance > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${balancePositive ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {balancePositive
              ? `${partnerNickname} owes you ${fmt(Math.abs(balance))} ${currency}`
              : `You owe ${partnerNickname} ${fmt(Math.abs(balance))} ${currency}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {splitMethod === 'equal' && '50 / 50 split'}
            {splitMethod === 'income_based' && incomeSplit && `${incomeSplit.myPct} / ${incomeSplit.partnerPct} income-based`}
            {splitMethod === 'income_based' && !incomeSplit && 'income-based (data incomplete)'}
            {splitMethod === 'custom' && `${customMyPct} / ${100 - customMyPct} custom`}
          </p>
          {Math.abs(balance) > 0 && (
            settlementForMonth ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                ✓ Settled on {new Date(settlementForMonth.settledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            ) : confirmSettle ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Settle?</span>
                <button
                  onClick={async () => { setSettlingUp(true); try { await onSettleUp(Math.abs(balance)); setConfirmSettle(false); } finally { setSettlingUp(false); } }}
                  disabled={settlingUp}
                  className="text-xs font-medium text-foreground hover:underline disabled:opacity-50"
                >
                  {settlingUp ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                </button>
                <button onClick={() => setConfirmSettle(false)} className="text-xs text-muted-foreground hover:underline">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmSettle(true)} className="mt-1 text-xs text-muted-foreground hover:underline">
                Mark as Settled
              </button>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {fmt(totalAmount)} {currency}
          </p>
          <p className="text-xs text-muted-foreground">this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base font-semibold">
            You paid: {fmt(myPaidTotal)} {currency}
          </p>
          <p className="text-sm text-muted-foreground">
            {partnerNickname} paid: {fmt(partnerPaidTotal)} {currency}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalsCard({
  goals,
  goalsLoading,
  currency,
  onAddGoal,
  onViewAll,
}: {
  goals: GoalResponse[];
  goalsLoading: boolean;
  currency: string;
  onAddGoal: () => void;
  onViewAll: () => void;
}) {
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Shared Goals</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onAddGoal}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {goalsLoading && activeGoals.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activeGoals.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No active goals yet</p>
        ) : (
          <>
            {activeGoals.map((goal) => {
              const pct = goal.targetAmount > 0
                ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
                : 0;
              return (
                <div key={goal._id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.name}</span>
                    {goal.deadline && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{pct}%</span>
                    <span>
                      {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)} {currency}
                    </span>
                  </div>
                </div>
              );
            })}
            {goals.filter((g) => g.status === 'active').length > 3 && (
              <button
                onClick={onViewAll}
                className="w-full text-center text-xs font-medium text-primary hover:underline"
              >
                View all goals
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const GOAL_STATUS_OPTIONS: { value: GoalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

const GOAL_CATEGORY_CHIP: Record<string, string> = {
  savings: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  travel: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  home: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  emergency: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
};

function FullGoalsCard({
  goals,
  goalsLoading,
  currency,
  currentUserId,
  isAdmin,
  onAddGoal,
  onContribute,
  onUpdateGoal,
  onDeleteGoal,
  onRemoveContribution,
}: {
  goals: GoalResponse[];
  goalsLoading: boolean;
  currency: string;
  currentUserId: string;
  isAdmin: boolean;
  onAddGoal: () => void;
  onContribute: (goal: GoalResponse) => void;
  onUpdateGoal: (goalId: string, input: { status: 'completed' | 'abandoned' }) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
  onRemoveContribution: (goalId: string, contributionId: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('active');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  const filtered = statusFilter === 'all'
    ? goals
    : goals.filter((g) => g.status === statusFilter);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Goals</CardTitle>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as GoalStatus | 'all')}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onAddGoal}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {goalsLoading && filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {statusFilter === 'all' ? 'No goals yet' : `No ${statusFilter} goals`}
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((goal) => {
              const pct = goal.targetAmount > 0
                ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
                : 0;
              const isExpanded = expandedGoalId === goal._id;
              const isCreator = goal.createdByUserId === currentUserId;
              const canManage = isCreator || isAdmin;

              return (
                <div key={goal._id} className="rounded-lg border border-border p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{goal.name}</span>
                        {goal.category && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${GOAL_CATEGORY_CHIP[goal.category] ?? GOAL_CATEGORY_CHIP.other}`}>
                            {goal.category}
                          </span>
                        )}
                        {goal.status !== 'active' && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            goal.status === 'completed'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400'
                          }`}>
                            {goal.status}
                          </span>
                        )}
                      </div>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {goal.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onContribute(goal)}
                        >
                          <Plus className="h-3 w-3" />
                          Contribute
                        </Button>
                      )}
                      {canManage && goal.status === 'active' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void onUpdateGoal(goal._id, { status: 'completed' })}
                            title="Mark as completed"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => void onUpdateGoal(goal._id, { status: 'abandoned' })}
                            title="Abandon goal"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => void onDeleteGoal(goal._id)}
                          title="Delete goal"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pct}%</span>
                      <span>
                        {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)} {currency}
                        {goal.deadline && (
                          <> · {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Contributions toggle */}
                  {goal.contributions.length > 0 && (
                    <button
                      onClick={() => setExpandedGoalId(isExpanded ? null : goal._id)}
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {goal.contributions.length} contribution{goal.contributions.length !== 1 ? 's' : ''}
                    </button>
                  )}

                  {/* Contributions list */}
                  {isExpanded && (
                    <div className="space-y-1.5 pl-2 border-l-2 border-muted ml-1">
                      {goal.contributions.map((c) => (
                          <div key={c._id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{c.memberNickname}</span>
                              <span className="text-muted-foreground">
                                +{fmt(c.amount)} {currency}
                              </span>
                              {c.note && (
                                <span className="text-muted-foreground">— {c.note}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <button
                                  onClick={() => void onRemoveContribution(goal._id, c._id)}
                                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                                  title="Remove contribution"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({
  taskLevel,
  setActiveTab,
  currency,
  expenses,
  tasks,
}: {
  taskLevel: TaskLevel;
  setActiveTab: (tab: Tab) => void;
  currency: string;
  expenses: ExpenseResponse[];
  tasks: TaskResponse[];
}) {
  const topExpenses = expenses.slice(0, 3);
  const pendingTasks = tasks.filter((t) => !t.isCompleted).slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Expenses summary */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expenses</p>
          {topExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No expenses this month.</p>
          ) : (
            topExpenses.map((expense) => (
              <div key={expense._id} className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    CATEGORY_CHIP_CLASSES[expense.category] ?? ''
                  }`}
                >
                  {expense.category}
                </span>
                <span className="flex-1 truncate text-sm">{expense.description}</span>
                <span className="shrink-0 text-sm font-semibold">
                  {fmt(expense.amount)} {currency}
                </span>
              </div>
            ))
          )}
          <button
            onClick={() => setActiveTab('expenses')}
            className="text-xs text-primary hover:underline"
          >
            → See all expenses
          </button>
        </div>

        {/* Tasks summary */}
        {taskLevel !== 'disabled' ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Tasks</p>
            {pendingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending tasks.</p>
            ) : (
              pendingTasks.map((task) => (
                <div key={task._id} className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded border-2 border-border" />
                  <span className="flex-1 text-sm">{task.title}</span>
                  {task.assignedToNickname && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {task.assignedToNickname}
                    </span>
                  )}
                </div>
              ))
            )}
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs text-primary hover:underline"
            >
              → See all tasks
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Task management is disabled.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SplitMethodCallout({
  splitMethod,
  customMyPct,
  setCustomMyPct,
  onCustomPctCommit,
  incomeSplit,
  myNickname,
  partnerNickname,
  isAdmin,
}: {
  splitMethod: SplitMethod;
  customMyPct: number;
  setCustomMyPct: (v: number) => void;
  onCustomPctCommit: (v: number) => void;
  incomeSplit: { myPct: number; partnerPct: number } | null;
  myNickname: string;
  partnerNickname: string;
  isAdmin: boolean;
}) {
  const customPartnerPct = 100 - customMyPct;

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      {splitMethod === 'equal' && (
        <p className="text-muted-foreground">Expenses are split <strong>50/50</strong> equally between both partners.</p>
      )}
      {splitMethod === 'income_based' && incomeSplit && (
        <div className="space-y-1.5">
          <p className="font-medium">Income-based split</p>
          <div className="grid grid-cols-2 gap-x-6 text-muted-foreground">
            <span>
              {myNickname} — <span className="font-medium text-foreground">({incomeSplit.myPct}%)</span>
            </span>
            <span>
              {partnerNickname} — <span className="font-medium text-foreground">({incomeSplit.partnerPct}%)</span>
            </span>
          </div>
        </div>
      )}
      {splitMethod === 'income_based' && !incomeSplit && (
        <p className="text-muted-foreground">Income data is incomplete — enter income above to see the split.</p>
      )}
      {splitMethod === 'custom' && (
        <div className="space-y-2">
          <p className="font-medium">Custom split</p>
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <span className="w-16 text-right text-xs text-muted-foreground">{myNickname} {customMyPct}%</span>
              <input
                type="range"
                min={1}
                max={99}
                step={1}
                value={customMyPct}
                onChange={(e) => setCustomMyPct(Number(e.target.value))}
                onMouseUp={(e) => onCustomPctCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => onCustomPctCommit(Number((e.target as HTMLInputElement).value))}
                className="flex-1 accent-primary"
              />
              <span className="w-16 text-xs text-muted-foreground">{partnerNickname} {customPartnerPct}%</span>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-muted-foreground">{myNickname} {customMyPct}% · {partnerNickname} {customPartnerPct}%</span>
              <p className="text-xs text-muted-foreground">Only an admin can change this.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FullExpensesCard({
  financeMode,
  splitMethod,
  customMyPct,
  setCustomMyPct,
  onCustomPctCommit,
  incomeSplit,
  myNickname,
  partnerNickname,
  currency,
  expenses,
  expensesLoading,
  currentMonth,
  onMonthChange,
  categoryFilter,
  onCategoryChange,
  onAddExpense,
  currentUserId,
  onEditExpense,
  onDeleteExpense,
  onClaimExpense,
  onResolveExpense,
  recurringExpenses,
  recurringLoading,
  onDeactivateRecurring,
  isAdmin,
  myParticipatesInFinances,
  hasFinancialPartner,
}: {
  financeMode: FinanceMode;
  splitMethod: SplitMethod;
  customMyPct: number;
  setCustomMyPct: (v: number) => void;
  onCustomPctCommit: (v: number) => void;
  incomeSplit: { myPct: number; partnerPct: number } | null;
  myNickname: string;
  partnerNickname: string;
  currency: string;
  expenses: ExpenseResponse[];
  expensesLoading: boolean;
  currentMonth: string;
  onMonthChange: (ym: string) => void;
  categoryFilter: ExpenseType | 'all';
  onCategoryChange: (cat: ExpenseType | 'all') => void;
  onAddExpense: () => void;
  currentUserId: string;
  onEditExpense: (e: ExpenseResponse) => void;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onClaimExpense: (expenseId: string) => Promise<void>;
  onResolveExpense: (expenseId: string) => Promise<void>;
  recurringExpenses: RecurringExpenseResponse[];
  recurringLoading: boolean;
  onDeactivateRecurring: (id: string) => Promise<void>;
  isAdmin: boolean;
  myParticipatesInFinances: boolean;
  hasFinancialPartner: boolean;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [confirmClaimId, setConfirmClaimId] = useState<string | null>(null);
  const [confirmResolveId, setConfirmResolveId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);

  // Client-side filter for display only — does not affect balance/stats
  const displayedExpenses = categoryFilter === 'all'
    ? expenses
    : expenses.filter((e) => e.category === categoryFilter);

  // Balance uses only unresolved paid expenses
  const paidExpenses = expenses.filter((e) => e.paidByUserId);
  const unresolvedPaidExpenses = paidExpenses.filter((e) => !e.isResolved);
  const totalAmount = unresolvedPaidExpenses.reduce((s, e) => s + e.amount, 0);
  const myPaidTotal = unresolvedPaidExpenses
    .filter((e) => e.paidByNickname === myNickname)
    .reduce((s, e) => s + e.amount, 0);

  // For balance in split mode
  let myShare = 0;
  if (splitMethod === 'equal') {
    myShare = totalAmount * 0.5;
  } else if (splitMethod === 'income_based' && incomeSplit) {
    myShare = totalAmount * (incomeSplit.myPct / 100);
  } else {
    myShare = totalAmount * (customMyPct / 100);
  }
  const balance = myPaidTotal - myShare;
  const balancePositive = balance > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMonthChange(stepMonth(currentMonth, 'prev'))}
            className="rounded p-1 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <CardTitle className="text-base font-semibold">{formatMonthLabel(currentMonth)}</CardTitle>
          <button
            onClick={() => onMonthChange(stepMonth(currentMonth, 'next'))}
            className="rounded p-1 hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onAddExpense}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {(['all', ...EXPENSE_TYPES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat as ExpenseType | 'all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-transparent hover:bg-muted'
              }`}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {financeMode === 'split' && (
          <SplitMethodCallout
            splitMethod={splitMethod}
            customMyPct={customMyPct}
            setCustomMyPct={setCustomMyPct}
            onCustomPctCommit={onCustomPctCommit}
            incomeSplit={incomeSplit}
            myNickname={myNickname}
            partnerNickname={partnerNickname}
            isAdmin={isAdmin}
          />
        )}

        {expensesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayedExpenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No expenses for {formatMonthLabel(currentMonth)}{categoryFilter !== 'all' ? ` · ${categoryFilter}` : ''}.
          </p>
        ) : (
          displayedExpenses.map((expense) => (
            <div key={expense._id} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    CATEGORY_CHIP_CLASSES[expense.category] ?? ''
                  }`}
                >
                  {expense.category}
                </span>
                {expense.recurringExpenseId && (
                  <span title="Recurring"><RefreshCw className="h-3 w-3 shrink-0 text-muted-foreground" /></span>
                )}
                <span className="flex-1 truncate text-sm font-medium">{expense.description}</span>
                {expense.paidByNickname ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {expense.paidByNickname}
                  </span>
                ) : (
                  <>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      Unpaid
                    </span>
                    {myParticipatesInFinances && (
                      confirmClaimId === expense._id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Claim?</span>
                          <button
                            onClick={async () => {
                              setClaimingId(expense._id);
                              setConfirmClaimId(null);
                              try { await onClaimExpense(expense._id); } finally { setClaimingId(null); }
                            }}
                            disabled={claimingId === expense._id}
                            className="text-xs font-medium text-foreground hover:underline disabled:opacity-50"
                          >
                            {claimingId === expense._id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmClaimId(null)}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmClaimId(expense._id)}
                          className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Claim
                        </button>
                      )
                    )}
                  </>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(expense.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {fmt(expense.amount)} {currency}
                </span>
                {expense.createdByUserId === currentUserId && (
                  confirmDeleteId === expense._id ? (
                    <div className="ml-2 flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Delete?</span>
                      <button
                        onClick={() => { void onDeleteExpense(expense._id).then(() => setConfirmDeleteId(null)); }}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="ml-2 flex items-center gap-1">
                      <button
                        onClick={() => onEditExpense(expense)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(expense._id)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>
              {financeMode === 'split' && myParticipatesInFinances && expense.paidByUserId && currentUserId !== expense.paidByUserId && (
                <div className="ml-2 flex items-center gap-1.5 flex-wrap">
                  {expense.isResolved ? (
                    <span className="text-xs text-green-600 dark:text-green-400">✓ Share settled</span>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {getMyShareLabel(expense, splitMethod, customMyPct, incomeSplit, currency)}
                      </span>
                      {confirmResolveId === expense._id ? (
                        <>
                          <span className="text-xs text-muted-foreground">Paid?</span>
                          <button
                            onClick={async () => {
                              setResolvingId(expense._id);
                              setConfirmResolveId(null);
                              try { await onResolveExpense(expense._id); } finally { setResolvingId(null); }
                            }}
                            disabled={resolvingId === expense._id}
                            className="text-xs font-medium text-foreground hover:underline disabled:opacity-50"
                          >
                            {resolvingId === expense._id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmResolveId(null)} className="text-xs text-muted-foreground hover:underline">No</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmResolveId(expense._id)} className="text-xs text-muted-foreground hover:underline">
                          Mark as Paid
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {financeMode === 'split' && myParticipatesInFinances && hasFinancialPartner && !expensesLoading && unresolvedPaidExpenses.length > 0 && (
          <div className="mt-2 border-t border-border pt-3 text-sm">
            <span className={balancePositive ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
              {balancePositive
                ? `${partnerNickname} owes you ${fmt(Math.abs(balance))} ${currency}`
                : `You owe ${partnerNickname} ${fmt(Math.abs(balance))} ${currency}`}
            </span>
            <span className="text-muted-foreground"> · based on {getBalanceSplitLabel(splitMethod, customMyPct, incomeSplit)}</span>
          </div>
        )}

        {/* Recurring Templates section */}
        <div className="mt-3 border-t border-border pt-3">
          <button
            onClick={() => setRecurringOpen((o) => !o)}
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Recurring Templates
              {recurringExpenses.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal">
                  {recurringExpenses.length}
                </span>
              )}
            </span>
            {recurringOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {recurringOpen && (
            <div className="mt-2 space-y-2">
              {recurringLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : recurringExpenses.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active recurring templates.</p>
              ) : (
                recurringExpenses.map((t) => (
                  <div key={t._id} className="flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        CATEGORY_CHIP_CLASSES[t.category] ?? ''
                      }`}
                    >
                      {t.category}
                    </span>
                    <span className="flex-1 truncate text-sm">{t.description}</span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground capitalize">
                      {t.interval}
                    </span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {t.payerMode === 'fixed' ? (t.fixedPayerNickname ?? 'Fixed') : 'Open'}
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {fmt(t.amount)} {currency}
                    </span>
                    {t.createdByUserId === currentUserId && (
                      <button
                        onClick={() => void onDeactivateRecurring(t._id)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="Deactivate"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SetRotationDialog({
  open,
  onOpenChange,
  taskMembers,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskMembers: HouseholdMemberResponse[];
  onConfirm: (startMemberId: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && taskMembers.length > 0) {
      setSelectedId(taskMembers[0]._id);
      setError(null);
    }
  }, [open, taskMembers]);

  if (!open) return null;

  async function handleConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedId);
      onOpenChange(false);
    } catch {
      setError('Failed to configure rotation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="mb-1 text-base font-semibold">Configure Rotation</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Select who starts the rotation. The order follows member positions and advances every 7 days.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Starts with</label>
            <Select value={selectedId} onValueChange={setSelectedId} disabled={submitting}>
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {taskMembers.map((m) => (
                  <SelectItem key={m._id} value={m._id}>{m.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleConfirm()} disabled={!selectedId || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksCard({
  taskLevel,
  distribution,
  tasks,
  rotationStatus,
  tasksLoading,
  isAdmin,
  taskMembers,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onAssignTask,
  onConfigureRotation,
  currentUserId,
  recurringTasks,
  recurringTasksLoading,
  onAddRecurringTask,
  onDeactivateRecurringTask,
}: {
  taskLevel: TaskLevel;
  distribution: DistributionMethod;
  tasks: TaskResponse[];
  rotationStatus: RotationStatus | null;
  tasksLoading: boolean;
  isAdmin: boolean;
  taskMembers: HouseholdMemberResponse[];
  onAddTask: () => void;
  onToggleComplete: (taskId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAssignTask: (taskId: string, memberId: string | null) => Promise<void>;
  onConfigureRotation: () => void;
  currentUserId: string;
  recurringTasks: RecurringTaskResponse[];
  recurringTasksLoading: boolean;
  onAddRecurringTask: () => void;
  onDeactivateRecurringTask: (id: string) => Promise<void>;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  if (taskLevel === 'disabled') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Task management is disabled for this household.
        </CardContent>
      </Card>
    );
  }

  async function handleToggle(taskId: string) {
    setTogglingId(taskId);
    try {
      await onToggleComplete(taskId);
    } finally {
      setTogglingId(null);
    }
  }

  const showRotationBanner = distribution === 'rotation' && taskLevel === 'full';
  const rotationNotConfigured = showRotationBanner && rotationStatus === null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Tasks</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onAddRecurringTask}>
            <RefreshCw className="h-3.5 w-3.5" />
            Recurring
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onAddTask}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Rotation banner */}
        {showRotationBanner && (
          rotationStatus ? (
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              This week: <strong>{rotationStatus.currentNickname}</strong> · Next week:{' '}
              <strong>{rotationStatus.nextNickname}</strong>
            </div>
          ) : isAdmin ? (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Rotation not configured yet.</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onConfigureRotation}
                disabled={taskMembers.length === 0}
              >
                Configure Rotation
              </Button>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Rotation not configured yet. Ask an admin to set it up.
            </div>
          )
        )}

        {tasksLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No tasks yet.{' '}
            {!rotationNotConfigured && (
              <button onClick={onAddTask} className="text-primary hover:underline">
                Add the first one.
              </button>
            )}
          </p>
        ) : (
          <div className="space-y-2">
            {(() => {
              const order = { overdue: 0, 'due-today': 1, upcoming: 2, none: 3 } as const;
              const sortedTasks = [...tasks].sort((a, b) => {
                if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                return (
                  order[getDueDateStatus(a.dueDate, a.isCompleted)] -
                  order[getDueDateStatus(b.dueDate, b.isCompleted)]
                );
              });
              return sortedTasks;
            })().map((task) => (
              <div
                key={task._id}
                className={`flex items-start gap-2 ${task.isCompleted ? 'opacity-60' : ''}`}
              >
                {/* Checkbox toggle */}
                <button
                  onClick={() => void handleToggle(task._id)}
                  disabled={togglingId === task._id}
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition-colors ${
                    task.isCompleted
                      ? 'border-primary bg-primary'
                      : 'border-border hover:border-primary'
                  } disabled:opacity-50`}
                >
                  {togglingId === task._id && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
                  )}
                </button>

                {/* Title + notes */}
                <div className="min-w-0 flex-1">
                  <span className={`text-sm ${task.isCompleted ? 'line-through' : ''}`}>
                    {task.recurringTaskId && (
                      <RefreshCw className="mr-1 inline h-3 w-3 text-muted-foreground" />
                    )}
                    {task.title}
                  </span>
                  {task.notes && (
                    <p className="text-xs text-muted-foreground">{task.notes}</p>
                  )}
                  {task.dueDate && (
                    <p className={`text-xs ${
                      getDueDateStatus(task.dueDate, task.isCompleted) === 'overdue'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                    }`}>
                      {task.isCompleted
                        ? `Due: ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
                        : formatDueDate(task.dueDate)}
                    </p>
                  )}
                </div>

                {/* Completed by or assigned to */}
                {task.isCompleted && task.completedByNickname ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Done by {task.completedByNickname}
                  </span>
                ) : distribution === 'rotation' && task.assignedToNickname && !task.isCompleted ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {task.assignedToNickname}
                  </span>
                ) : distribution === 'fixed' && !task.isCompleted ? (
                  assigningTaskId === task._id ? (
                    <Select
                      defaultValue={task.assignedToMemberId ?? '__none__'}
                      onValueChange={(val) => {
                        const resolved = val === '__none__' ? null : val;
                        void onAssignTask(task._id, resolved).finally(() => setAssigningTaskId(null));
                      }}
                      onOpenChange={(open) => { if (!open) setAssigningTaskId(null); }}
                      defaultOpen
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassign</SelectItem>
                        {taskMembers.map((m) => (
                          <SelectItem key={m._id} value={m._id}>{m.nickname}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : task.assignedToNickname ? (
                    <button
                      onClick={() => setAssigningTaskId(task._id)}
                      className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/70"
                    >
                      {task.assignedToNickname}
                    </button>
                  ) : (
                    <button
                      onClick={() => setAssigningTaskId(task._id)}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      + Assign
                    </button>
                  )
                ) : null}

                {getDueDateStatus(task.dueDate, task.isCompleted) === 'overdue' && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    Overdue
                  </span>
                )}

                {/* Delete button */}
                {(task.createdByUserId === currentUserId || isAdmin) && (
                  confirmDeleteId === task._id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Delete?</span>
                      <button
                        onClick={() => {
                          void onDeleteTask(task._id).then(() => setConfirmDeleteId(null));
                        }}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(task._id)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recurring Tasks subsection */}
        {(recurringTasksLoading || recurringTasks.length > 0) && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Recurring</p>
            {recurringTasksLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {recurringTasks.map((rt) => (
                  <div key={rt._id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{rt.title}</span>
                      </div>
                      <p className="ml-4.5 text-xs text-muted-foreground capitalize">{rt.interval}</p>
                    </div>
                    {rt.assignedToNickname && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {rt.assignedToNickname}
                      </span>
                    )}
                    <button
                      onClick={() => void onDeactivateRecurringTask(rt._id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      title="Deactivate"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface CoupleDashboardProps {
  household: HouseholdResponse;
  currentUserId: string;
}

export default function CoupleDashboard({ household, currentUserId }: CoupleDashboardProps) {
  const [financeMode, setFinanceMode] = useState<FinanceMode>(
    (household.settings.financeMode as FinanceMode) ?? 'split'
  );
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(
    (household.settings.expenseSplitMethod as SplitMethod) ?? 'equal'
  );
  const [taskLevel, setTaskLevel] = useState<TaskLevel>(
    (household.settings.taskManagementEnabled as TaskLevel) ?? 'full'
  );
  const [distribution, setDistribution] = useState<DistributionMethod>(
    (household.settings.taskDistributionMethod as DistributionMethod) ?? 'rotation'
  );
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState(false);
  const [customMyPct, setCustomMyPct] = useState(
    household.settings.customSplitPercentage ?? 50
  );

  // UI-only state
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [rotationConfigOpen, setRotationConfigOpen] = useState(false);
  const [addRecurringTaskOpen, setAddRecurringTaskOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [categoryFilter, setCategoryFilter] = useState<ExpenseType | 'all'>('all');
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [contributionTarget, setContributionTarget] = useState<GoalResponse | null>(null);

  // ── Query hooks ────────────────────────────────────────────────────────
  const { data: expensesData, isLoading: expensesLoading } = useExpenses(household._id, currentMonth);
  const expenses = expensesData ?? [];

  const { data: recurringExpensesData, isLoading: recurringLoading } = useRecurringExpenses(
    household._id,
    activeTab === 'expenses'
  );
  const recurringExpenses = recurringExpensesData ?? [];

  const { data: tasksData, isLoading: tasksLoading } = useTasks(
    household._id,
    activeTab === 'tasks' || activeTab === 'overview'
  );
  const tasks = tasksData?.tasks ?? [];
  const rotationStatus = tasksData?.rotation ?? null;

  const { data: recurringTasksData, isLoading: recurringTasksLoading } = useRecurringTasks(
    household._id,
    activeTab === 'tasks'
  );
  const recurringTasks = recurringTasksData ?? [];

  const { data: goalsData, isLoading: goalsLoading } = useGoals(
    household._id,
    activeTab === 'overview' || activeTab === 'goals'
  );
  const goals = goalsData ?? [];

  // ── Mutation hooks ─────────────────────────────────────────────────────
  const deleteExpenseMutation = useDeleteExpense(household._id);
  const claimExpenseMutation = useClaimExpense(household._id);
  const resolveExpenseMutation = useResolveExpense(household._id);
  const deactivateRecurringExpenseMutation = useDeactivateRecurringExpense(household._id);
  const toggleCompleteMutation = useToggleTaskComplete(household._id);
  const deleteTaskMutation = useDeleteTask(household._id);
  const assignTaskMutation = useAssignTask(household._id);
  const setRotationMutation = useSetRotation(household._id);
  const deactivateRecurringTaskMutation = useDeactivateRecurringTask(household._id);
  const updateGoalMutation = useUpdateGoal(household._id);
  const deleteGoalMutation = useDeleteGoal(household._id);
  const removeContributionMutation = useRemoveContribution(household._id);
  const updateSettingsMutation = useUpdateSettings(household._id);
  const settleMutation = useRecordSettlement(household._id);

  // Derived member data
  const myMember = household.members.find((m) => m.userId === currentUserId);
  const partnerMember = household.members.find(
    (m) => m.userId && m.userId !== currentUserId && m.participatesInFinances
  );
  const myNickname = myMember?.nickname ?? 'You';
  const partnerNickname = partnerMember?.nickname ?? 'Partner';
  const currency = household.settings.currency ?? MOCK_CURRENCY;
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';
  const myParticipatesInFinances = myMember?.participatesInFinances ?? false;
  const hasFinancialPartner = partnerMember != null;

  // Save handlers — only called when isAdmin
  const handleFinanceModeChange = async (v: FinanceMode) => {
    setFinanceMode(v);
    if (!isAdmin) return;
    try {
      await updateSettingsMutation.mutateAsync({ financeMode: v });
    } catch {
      // silently ignore save errors — UI already reflects the change
    }
  };

  const handleSplitMethodChange = async (v: SplitMethod) => {
    setSplitMethod(v);
    if (!isAdmin) return;
    try {
      await updateSettingsMutation.mutateAsync({ expenseSplitMethod: v });
    } catch {
      // silently ignore
    }
  };

  const handleCustomPctCommit = async (v: number) => {
    if (!isAdmin) return;
    try {
      await updateSettingsMutation.mutateAsync({ customSplitPercentage: v });
    } catch {
      // silently ignore
    }
  };

  // Derive income split from real data when income_based is active
  const incomeSplit = splitMethod === 'income_based'
    ? deriveIncomeSplit(household, currentUserId)
    : null;

  // Show income entry card when income_based is configured and the current user is a financial member
  const showIncomeCard = splitMethod === 'income_based' && (myMember?.participatesInFinances ?? false);

  // Task-participating members (for rotation dialog)
  const taskMembers = household.members.filter((m) => m.participatesInTasks);

  // totalAmount / myPaidTotal / partnerPaidTotal cover ALL paid expenses (for "Total Spent" and
  // "Your Payments" display). StatsRow derives unresolved amounts internally for the balance card.
  const paidExpenses = expenses.filter((e) => e.paidByUserId);
  const totalAmount = paidExpenses.reduce((s, e) => s + e.amount, 0);
  const myPaidTotal = paidExpenses
    .filter((e) => e.paidByNickname === myNickname)
    .reduce((s, e) => s + e.amount, 0);
  const partnerPaidTotal = totalAmount - myPaidTotal;

  const settlementForMonth = (household.settlements ?? []).find((s) => s.month === currentMonth) ?? null;

  const handleSettleUp = async (amount: number) => {
    await settleMutation.mutateAsync({ month: currentMonth, amount });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const subLine = [
    `${myNickname} & ${partnerNickname}`,
    financeMode === 'split'
      ? `Split: ${splitMethod === 'equal' ? 'Equal' : splitMethod === 'income_based' ? 'Income-based' : 'Custom'}`
      : 'Joint finances',
    taskLevel !== 'disabled'
      ? `Tasks: ${distribution.charAt(0).toUpperCase() + distribution.slice(1)}`
      : 'Tasks: Off',
  ].join(' · ');

  const overdueCount = tasks.filter(
    (t) => !t.isCompleted && getDueDateStatus(t.dueDate, t.isCompleted) === 'overdue'
  ).length;

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Mock Controls */}
        <MockControls
          financeMode={financeMode}
          setFinanceMode={handleFinanceModeChange}
          splitMethod={splitMethod}
          setSplitMethod={handleSplitMethodChange}
          taskLevel={taskLevel}
          setTaskLevel={setTaskLevel}
          distribution={distribution}
          setDistribution={setDistribution}
          isAdmin={isAdmin}
        />

        {/* Income Entry Card */}
        {showIncomeCard && (
          <IncomeEntryCard
            household={household}
            currentUserId={currentUserId}
          />
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{household.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{subLine}</p>
          </div>
          <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {financeMode === 'joint' ? 'Joint finances' : `Split: ${splitMethod}`}
          </div>
        </div>

        {/* Invite Code */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2">
          <span className="text-xs text-muted-foreground shrink-0">Invite code:</span>
          <span className="flex-1 font-mono text-xs tracking-wide">{household.inviteCode}</span>
          <button
            onClick={() => void handleCopy()}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
            title="Copy invite code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-0 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary font-medium text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.id === 'tasks' && overdueCount > 0 ? `Tasks (${overdueCount})` : tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <StatsRow
              financeMode={financeMode}
              splitMethod={splitMethod}
              customMyPct={customMyPct}
              incomeSplit={incomeSplit}
              myNickname={myNickname}
              partnerNickname={partnerNickname}
              currency={currency}
              expenses={expenses}
              myPaidTotal={myPaidTotal}
              partnerPaidTotal={partnerPaidTotal}
              totalAmount={totalAmount}
              settlementForMonth={settlementForMonth}
              onSettleUp={handleSettleUp}
              myParticipatesInFinances={myParticipatesInFinances}
              hasFinancialPartner={hasFinancialPartner}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <GoalsCard
                goals={goals}
                goalsLoading={goalsLoading}
                currency={currency}
                onAddGoal={() => setAddGoalOpen(true)}
                onViewAll={() => setActiveTab('goals')}
              />
              <RecentActivityCard
                taskLevel={taskLevel}
                setActiveTab={setActiveTab}
                currency={currency}
                expenses={expenses}
                tasks={tasks}
              />
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <FullExpensesCard
            financeMode={financeMode}
            splitMethod={splitMethod}
            customMyPct={customMyPct}
            setCustomMyPct={setCustomMyPct}
            onCustomPctCommit={handleCustomPctCommit}
            incomeSplit={incomeSplit}
            myNickname={myNickname}
            partnerNickname={partnerNickname}
            currency={currency}
            expenses={expenses}
            expensesLoading={expensesLoading}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            onAddExpense={() => setAddExpenseOpen(true)}
            currentUserId={currentUserId}
            onEditExpense={(e) => setEditingExpense(e)}
            onDeleteExpense={async (expenseId) => { await deleteExpenseMutation.mutateAsync(expenseId); }}
            onClaimExpense={async (expenseId) => { await claimExpenseMutation.mutateAsync(expenseId); }}
            onResolveExpense={async (expenseId) => { await resolveExpenseMutation.mutateAsync(expenseId); }}
            recurringExpenses={recurringExpenses}
            recurringLoading={recurringLoading}
            onDeactivateRecurring={async (id) => { await deactivateRecurringExpenseMutation.mutateAsync(id); }}
            isAdmin={isAdmin}
            myParticipatesInFinances={myParticipatesInFinances}
            hasFinancialPartner={hasFinancialPartner}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksCard
            taskLevel={taskLevel}
            distribution={distribution}
            tasks={tasks}
            rotationStatus={rotationStatus}
            tasksLoading={tasksLoading}
            isAdmin={isAdmin}
            taskMembers={taskMembers}
            onAddTask={() => setAddTaskOpen(true)}
            onToggleComplete={async (taskId) => { await toggleCompleteMutation.mutateAsync(taskId); }}
            onDeleteTask={async (taskId) => { await deleteTaskMutation.mutateAsync(taskId); }}
            onAssignTask={async (taskId, memberId) => {
              await assignTaskMutation.mutateAsync({ taskId, input: { assignedToMemberId: memberId } });
            }}
            onConfigureRotation={() => setRotationConfigOpen(true)}
            currentUserId={currentUserId}
            recurringTasks={recurringTasks}
            recurringTasksLoading={recurringTasksLoading}
            onAddRecurringTask={() => setAddRecurringTaskOpen(true)}
            onDeactivateRecurringTask={async (id) => { await deactivateRecurringTaskMutation.mutateAsync(id); }}
          />
        )}

        {activeTab === 'goals' && (
          <FullGoalsCard
            goals={goals}
            goalsLoading={goalsLoading}
            currency={currency}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onAddGoal={() => setAddGoalOpen(true)}
            onContribute={(goal) => setContributionTarget(goal)}
            onUpdateGoal={async (goalId, input) => {
              await updateGoalMutation.mutateAsync({ goalId, input });
            }}
            onDeleteGoal={async (goalId) => { await deleteGoalMutation.mutateAsync(goalId); }}
            onRemoveContribution={async (goalId, contributionId) => {
              await removeContributionMutation.mutateAsync({ goalId, contributionId });
            }}
          />
        )}
      </div>

      {/* Add Task Sheet */}
      <AddTaskForm
        householdId={household._id}
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        distributionMethod={distribution}
        taskMembers={taskMembers}
      />

      {/* Add Recurring Task Sheet */}
      <AddRecurringTaskForm
        householdId={household._id}
        open={addRecurringTaskOpen}
        onOpenChange={setAddRecurringTaskOpen}
        distributionMethod={distribution}
        taskMembers={taskMembers}
      />

      {/* Set Rotation Dialog */}
      <SetRotationDialog
        open={rotationConfigOpen}
        onOpenChange={setRotationConfigOpen}
        taskMembers={taskMembers}
        onConfirm={async (startMemberId) => { await setRotationMutation.mutateAsync(startMemberId); }}
      />

      {/* Add / Edit Expense Sheet */}
      <AddExpenseForm
        open={addExpenseOpen || editingExpense !== null}
        onOpenChange={(o) => {
          if (!o) { setAddExpenseOpen(false); setEditingExpense(null); }
        }}
        household={household}
        expense={editingExpense ?? undefined}
      />

      {/* Add Goal Sheet */}
      <AddGoalForm
        householdId={household._id}
        open={addGoalOpen}
        onOpenChange={setAddGoalOpen}
        currency={currency}
      />

      {/* Add Contribution Sheet */}
      <AddContributionDialog
        householdId={household._id}
        goalId={contributionTarget?._id ?? ''}
        goalName={contributionTarget?.name ?? ''}
        open={contributionTarget !== null}
        onOpenChange={(o) => {
          if (!o) setContributionTarget(null);
        }}
        currency={currency}
      />
    </div>
  );
}
