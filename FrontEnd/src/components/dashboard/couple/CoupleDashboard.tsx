import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Loader2, Pencil, Trash2, RefreshCw, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { HouseholdResponse } from '@/types/household.types';
import type { ExpenseResponse } from '@/types/expense.types';
import type { RecurringExpenseResponse } from '@/types/recurring-expense.types';
import type { ExpenseType } from '@/types/onboarding.types';
import { EXPENSE_TYPES } from '@/types/onboarding.types';
import { expenseApi } from '@/api/expense.api';
import { recurringExpenseApi } from '@/api/recurring-expense.api';
import { householdApi } from '@/api/household.api';
import IncomeEntryCard from '@/components/dashboard/shared/IncomeEntryCard';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';

// ── Types ──────────────────────────────────────────────────────────────────

type FinanceMode = 'joint' | 'split';
type SplitMethod = 'equal' | 'income_based' | 'custom';
type TaskLevel = 'full' | 'basic' | 'disabled';
type DistributionMethod = 'rotation' | 'fixed' | 'voluntary';
type Tab = 'overview' | 'expenses' | 'tasks';

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_CURRENCY = 'лв';

const MOCK_GOALS = [
  { id: 1, name: 'Summer Vacation', target: 3000, current: 1200, deadline: 'Jul 2026' },
  { id: 2, name: 'New Sofa', target: 800, current: 320, deadline: 'Apr 2026' },
];

const MOCK_TASKS = {
  rotation: [
    { id: 1, title: 'Buy groceries', assignedTo: 'Sam', due: 'Today', done: false, note: 'This week: Sam' },
    { id: 2, title: 'Take out trash', assignedTo: 'Alex', due: 'Tomorrow', done: false, note: 'This week: Alex' },
    { id: 3, title: 'Clean bathroom', assignedTo: 'Sam', due: 'This week', done: false },
    { id: 4, title: 'Vacuum living room', assignedTo: 'Alex', due: 'Last week', done: true },
  ],
  fixed: [
    { id: 1, title: 'Take out trash', assignedTo: 'Alex', due: 'Tomorrow', done: false, fixed: true },
    { id: 2, title: 'Vacuum living room', assignedTo: 'Alex', due: 'This week', done: false, fixed: true },
    { id: 3, title: 'Buy groceries', assignedTo: 'Sam', due: 'Today', done: false, fixed: true },
    { id: 4, title: 'Clean bathroom', assignedTo: 'Sam', due: 'This week', done: true, fixed: true },
  ],
  voluntary: [
    { id: 1, title: 'Buy groceries', claimedBy: 'Sam', due: 'Today', done: false },
    { id: 2, title: 'Take out trash', claimedBy: null, due: 'Tomorrow', done: false },
    { id: 3, title: 'Clean bathroom', claimedBy: null, due: 'This week', done: false },
    { id: 4, title: 'Vacuum living room', claimedBy: 'Alex', due: 'Last week', done: true },
  ],
};

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

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'tasks', label: 'Tasks' },
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

function GoalsCard({ currency }: { currency: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Shared Goals</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {MOCK_GOALS.map((goal) => {
          const pct = Math.round((goal.current / goal.target) * 100);
          return (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{goal.name}</span>
                <span className="text-xs text-muted-foreground">{goal.deadline}</span>
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
                  {fmt(goal.current)} / {fmt(goal.target)} {currency}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({
  taskLevel,
  distribution,
  setActiveTab,
  currency,
  expenses,
}: {
  taskLevel: TaskLevel;
  distribution: DistributionMethod;
  setActiveTab: (tab: Tab) => void;
  currency: string;
  expenses: ExpenseResponse[];
}) {
  const topExpenses = expenses.slice(0, 3);

  const taskList = MOCK_TASKS[distribution];
  const pendingTasks = taskList.filter((t) => !t.done).slice(0, 2);

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
            {pendingTasks.map((task) => {
              const label =
                'claimedBy' in task
                  ? (task.claimedBy ?? 'Unclaimed')
                  : (task as { assignedTo: string }).assignedTo;
              return (
                <div key={task.id} className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded border-2 border-border" />
                  <span className="flex-1 text-sm">{task.title}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {label}
                  </span>
                </div>
              );
            })}
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
                    {confirmClaimId === expense._id ? (
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
              {financeMode === 'split' && expense.paidByUserId && (
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

        {financeMode === 'split' && !expensesLoading && unresolvedPaidExpenses.length > 0 && (
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

function TasksCard({ taskLevel, distribution, myNickname, partnerNickname }: { taskLevel: TaskLevel; distribution: DistributionMethod; myNickname: string; partnerNickname: string }) {
  if (taskLevel === 'disabled') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Task management is disabled for this household.
        </CardContent>
      </Card>
    );
  }

  const tasks = MOCK_TASKS[distribution];

  if (taskLevel === 'basic') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {MOCK_TASKS.rotation.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
            >
              <div
                className={`h-4 w-4 shrink-0 rounded border-2 ${
                  task.done ? 'border-primary bg-primary' : 'border-border'
                }`}
              />
              <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {task.assignedTo}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Full level
  if (distribution === 'rotation') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            🔄 This week: <strong>{partnerNickname}</strong> · Next week: <strong>{myNickname}</strong>
          </div>
          <div className="space-y-2">
            {(tasks as typeof MOCK_TASKS.rotation).map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
              >
                <div
                  className={`h-4 w-4 shrink-0 rounded border-2 ${
                    task.done ? 'border-primary bg-primary' : 'border-border'
                  }`}
                />
                <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {task.assignedTo}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (distribution === 'fixed') {
    const myTasks = (tasks as typeof MOCK_TASKS.fixed).filter((t) => t.assignedTo === 'Alex');
    const partnerTasks = (tasks as typeof MOCK_TASKS.fixed).filter((t) => t.assignedTo === 'Sam');

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: `${myNickname}'s tasks`, items: myTasks },
            { label: `${partnerNickname}'s tasks`, items: partnerTasks },
          ].map(({ label, items }) => (
            <div key={label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              {items.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`h-4 w-4 shrink-0 rounded border-2 ${
                      task.done ? 'border-primary bg-primary' : 'border-border'
                    }`}
                  />
                  <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // voluntary
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Anyone can claim any task
        </div>
        <div className="space-y-2">
          {(tasks as typeof MOCK_TASKS.voluntary).map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
            >
              <div
                className={`h-4 w-4 shrink-0 rounded border-2 ${
                  task.done ? 'border-primary bg-primary' : 'border-border'
                }`}
              />
              <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
              {task.claimedBy ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {task.claimedBy}
                </span>
              ) : (
                !task.done && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                    Claim
                  </Button>
                )
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface CoupleDashboardProps {
  household: HouseholdResponse;
  currentUserId: string;
  onHouseholdUpdated: (updated: HouseholdResponse) => void;
}

export default function CoupleDashboard({ household, currentUserId, onHouseholdUpdated }: CoupleDashboardProps) {
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

  // Expense state
  const [expenses, setExpenses] = useState<ExpenseResponse[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseResponse[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [categoryFilter, setCategoryFilter] = useState<ExpenseType | 'all'>('all');
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null);

  // Derive real names from household members
  const myMember = household.members.find((m) => m.userId === currentUserId);
  const partnerMember = household.members.find((m) => m.userId && m.userId !== currentUserId);
  const myNickname = myMember?.nickname ?? 'You';
  const partnerNickname = partnerMember?.nickname ?? 'Partner';
  const currency = household.settings.currency ?? MOCK_CURRENCY;
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';

  // Save handlers — only called when isAdmin
  const handleFinanceModeChange = async (v: FinanceMode) => {
    setFinanceMode(v);
    if (!isAdmin) return;
    try {
      const updated = await householdApi.updateSettings(household._id, { financeMode: v });
      onHouseholdUpdated(updated);
    } catch {
      // silently ignore save errors — UI already reflects the change
    }
  };

  const handleSplitMethodChange = async (v: SplitMethod) => {
    setSplitMethod(v);
    if (!isAdmin) return;
    try {
      const updated = await householdApi.updateSettings(household._id, { expenseSplitMethod: v });
      onHouseholdUpdated(updated);
    } catch {
      // silently ignore
    }
  };

  const handleCustomPctCommit = async (v: number) => {
    if (!isAdmin) return;
    try {
      const updated = await householdApi.updateSettings(household._id, { customSplitPercentage: v });
      onHouseholdUpdated(updated);
    } catch {
      // silently ignore
    }
  };

  // Derive income split from real data when income_based is active
  const incomeSplit = splitMethod === 'income_based'
    ? deriveIncomeSplit(household, currentUserId)
    : null;

  // Show income entry card when income_based is configured and any member is missing income
  const showIncomeCard = splitMethod === 'income_based';

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const data = await expenseApi.listExpenses(
        household._id,
        currentMonth
        // no category filter — always fetch all expenses for the month
      );
      setExpenses(data);
    } catch {
      // silently keep previous state
    } finally {
      setExpensesLoading(false);
    }
  }, [household._id, currentMonth]);

  const fetchRecurringExpenses = useCallback(async () => {
    setRecurringLoading(true);
    try {
      const data = await recurringExpenseApi.list(household._id);
      setRecurringExpenses(data);
    } catch {
      // silently keep previous state
    } finally {
      setRecurringLoading(false);
    }
  }, [household._id]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    if (activeTab === 'expenses') {
      fetchRecurringExpenses();
    }
  }, [activeTab, fetchRecurringExpenses]);

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
    const updated = await householdApi.recordSettlement(household._id, currentMonth, amount);
    onHouseholdUpdated(updated);
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
            onUpdated={onHouseholdUpdated}
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
              {tab.label}
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
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <GoalsCard currency={currency} />
              <RecentActivityCard
                taskLevel={taskLevel}
                distribution={distribution}
                setActiveTab={setActiveTab}
                currency={currency}
                expenses={expenses}
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
            onDeleteExpense={async (expenseId) => {
              await expenseApi.deleteExpense(household._id, expenseId);
              await fetchExpenses();
            }}
            onClaimExpense={async (expenseId) => {
              await expenseApi.claimExpense(household._id, expenseId);
              await fetchExpenses();
            }}
            onResolveExpense={async (expenseId) => {
              await expenseApi.resolveExpense(household._id, expenseId);
              await fetchExpenses();
            }}
            recurringExpenses={recurringExpenses}
            recurringLoading={recurringLoading}
            onDeactivateRecurring={async (id) => {
              await recurringExpenseApi.deactivate(household._id, id);
              await fetchRecurringExpenses();
            }}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksCard
            taskLevel={taskLevel}
            distribution={distribution}
            myNickname={myNickname}
            partnerNickname={partnerNickname}
          />
        )}
      </div>

      {/* Add / Edit Expense Sheet */}
      <AddExpenseForm
        open={addExpenseOpen || editingExpense !== null}
        onOpenChange={(o) => {
          if (!o) { setAddExpenseOpen(false); setEditingExpense(null); }
        }}
        household={household}
        expense={editingExpense ?? undefined}
        onSaved={() => { void fetchExpenses(); void fetchRecurringExpenses(); }}
      />
    </div>
  );
}
