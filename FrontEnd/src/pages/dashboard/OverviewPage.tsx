import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useExpenses, useJointAccountSummary } from '@/hooks/queries';
import IncomeEntryCard from '@/components/dashboard/shared/IncomeEntryCard';
import {
  fmt,
  CATEGORY_CHIP_CLASSES,
  currentMonthString,
} from '@/utils/dashboardHelpers';

export default function OverviewPage() {
  const navigate = useNavigate();
  const {
    household,
    currentUserId,
    financeMode,
    splitMethod,
    customMyPct,
    incomeSplit,
    myNickname,
    partnerNickname,
    currency,
    myParticipatesInFinances,
    hasFinancialPartner,
    tasks,
    goals,
    goalsLoading,
    taskLevel,
    handleSettleUp,
    setAddGoalOpen,
    setAddTransactionOpen,
    splitMethod: _splitMethod,
  } = useDashboard();

  const currentMonth = currentMonthString();

  const { data: expensesData, isLoading: expensesLoading } = useExpenses(household._id, currentMonth);
  const expenses = expensesData ?? [];

  const { data: jointAccountData } = useJointAccountSummary(
    household._id,
    currentMonth,
    financeMode === 'joint'
  );
  const jointAccount = jointAccountData ?? null;

  const showIncomeCard = splitMethod === 'income_based' && myParticipatesInFinances;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {myNickname} &amp; {partnerNickname} · {household.name}
        </p>
      </div>

      {showIncomeCard && (
        <IncomeEntryCard household={household} currentUserId={currentUserId} />
      )}

      <StatsRow
        financeMode={financeMode}
        splitMethod={splitMethod}
        customMyPct={customMyPct}
        incomeSplit={incomeSplit}
        myNickname={myNickname}
        partnerNickname={partnerNickname}
        currency={currency}
        expenses={expenses}
        myParticipatesInFinances={myParticipatesInFinances}
        hasFinancialPartner={hasFinancialPartner}
        currentMonth={currentMonth}
        onSettleUp={handleSettleUp}
        household={household}
      />

      {financeMode === 'joint' && jointAccount && (
        <JointAccountOverviewCard
          jointAccount={jointAccount}
          currency={currency}
          onViewAccount={() => navigate('/dashboard/account')}
          onAddFunds={() => setAddTransactionOpen(true)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GoalsPreviewCard
          goals={goals}
          goalsLoading={goalsLoading}
          currency={currency}
          onAddGoal={() => setAddGoalOpen(true)}
          onViewAll={() => navigate('/dashboard/goals')}
        />
        <RecentActivityCard
          taskLevel={taskLevel}
          currency={currency}
          expenses={expenses}
          tasks={tasks}
          expensesLoading={expensesLoading}
          onViewExpenses={() => navigate('/dashboard/expenses')}
          onViewTasks={() => navigate('/dashboard/tasks')}
        />
      </div>
    </div>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────

import type { ExpenseResponse } from '@/types/expense.types';
import type { HouseholdResponse } from '@/types/household.types';
import type { Settlement } from '@/types/household.types';

function StatsRow({
  financeMode,
  splitMethod,
  customMyPct,
  incomeSplit,
  myNickname,
  partnerNickname,
  currency,
  expenses,
  myParticipatesInFinances,
  hasFinancialPartner,
  currentMonth,
  onSettleUp,
  household,
}: {
  financeMode: string;
  splitMethod: string;
  customMyPct: number;
  incomeSplit: { myPct: number; partnerPct: number } | null;
  myNickname: string;
  partnerNickname: string;
  currency: string;
  expenses: ExpenseResponse[];
  myParticipatesInFinances: boolean;
  hasFinancialPartner: boolean;
  currentMonth: string;
  onSettleUp: (month: string, amount: number) => Promise<void>;
  household: HouseholdResponse;
}) {
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [settlingUp, setSettlingUp] = useState(false);

  const settlementForMonth =
    (household.settlements ?? []).find((s: Settlement) => s.month === currentMonth) ?? null;

  const paidExpenses = expenses.filter((e) => e.paidByUserId);
  const totalAmount = paidExpenses.reduce((s, e) => s + e.amount, 0);
  const myPaidTotal = paidExpenses
    .filter((e) => e.paidByNickname === myNickname)
    .reduce((s, e) => s + e.amount, 0);
  const partnerPaidTotal = totalAmount - myPaidTotal;

  if (financeMode === 'joint') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Spent" value={`${fmt(totalAmount)} ${currency}`} sub="this month" />
        <StatCard label="Per Person" value={`~${fmt(totalAmount / 2)} ${currency}`} sub="each" />
        <StatCard label="Expenses" value={String(expenses.length)} sub="this month" />
      </div>
    );
  }

  if (!myParticipatesInFinances || !hasFinancialPartner) {
    const note = !myParticipatesInFinances
      ? 'You are not part of the shared finances.'
      : 'No financial partner found.';
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total Spent" value={`${fmt(totalAmount)} ${currency}`} sub="this month" />
        <StatCard label="Expenses" value={String(expenses.length)} sub={note} />
      </div>
    );
  }

  // Split mode — balance uses only unresolved paid expenses
  const unresolvedPaid = expenses.filter((e) => e.paidByUserId && !e.isResolved);
  const unresolvedTotal = unresolvedPaid.reduce((s, e) => s + e.amount, 0);
  const myUnresolvedPaid = unresolvedPaid
    .filter((e) => e.paidByNickname === myNickname)
    .reduce((s, e) => s + e.amount, 0);
  let myShare = 0;
  if (splitMethod === 'equal') myShare = unresolvedTotal * 0.5;
  else if (splitMethod === 'income_based' && incomeSplit) myShare = unresolvedTotal * (incomeSplit.myPct / 100);
  else myShare = unresolvedTotal * (customMyPct / 100);
  const balance = myUnresolvedPaid - myShare;
  const balancePositive = balance > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-xl font-bold leading-tight ${balancePositive ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {balancePositive
              ? `${partnerNickname} owes you ${fmt(Math.abs(balance))} ${currency}`
              : `You owe ${partnerNickname} ${fmt(Math.abs(balance))} ${currency}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {splitMethod === 'equal' && '50/50 split'}
            {splitMethod === 'income_based' && incomeSplit && `${incomeSplit.myPct}/${incomeSplit.partnerPct} income-based`}
            {splitMethod === 'income_based' && !incomeSplit && 'income-based (data incomplete)'}
            {splitMethod === 'custom' && `${customMyPct}/${100 - customMyPct} custom`}
          </p>
          {Math.abs(balance) > 0 && (
            settlementForMonth ? (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                ✓ Settled {new Date(settlementForMonth.settledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            ) : confirmSettle ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Mark as settled?</span>
                <button
                  onClick={async () => {
                    setSettlingUp(true);
                    try { await onSettleUp(currentMonth, Math.abs(balance)); setConfirmSettle(false); }
                    finally { setSettlingUp(false); }
                  }}
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

      <StatCard label="Total Spent" value={`${fmt(totalAmount)} ${currency}`} sub="this month" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base font-semibold">You paid: {fmt(myPaidTotal)} {currency}</p>
          <p className="text-sm text-muted-foreground">{partnerNickname} paid: {fmt(partnerPaidTotal)} {currency}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Joint Account Overview Card ───────────────────────────────────────────

import type { JointAccountSummaryResponse } from '@/types/joint-account.types';

function JointAccountOverviewCard({
  jointAccount,
  currency,
  onViewAccount,
  onAddFunds,
}: {
  jointAccount: JointAccountSummaryResponse;
  currency: string;
  onViewAccount: () => void;
  onAddFunds: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Joint Account Balance</p>
              <p className={`text-xl font-bold ${jointAccount.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(jointAccount.balance)} {currency}
              </p>
            </div>
            {jointAccount.monthlyTarget != null && (
              <div className="border-l border-border pl-4">
                <p className="text-xs text-muted-foreground">Deposits this month</p>
                <p className="text-sm font-semibold">
                  {fmt(jointAccount.monthlyDeposits)} / {fmt(jointAccount.monthlyTarget)} {currency}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onAddFunds}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Funds
            </Button>
            <Button variant="ghost" size="sm" onClick={onViewAccount}>
              View Account
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Goals Preview Card ────────────────────────────────────────────────────

import type { GoalResponse } from '@/types/goal.types';

function GoalsPreviewCard({
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
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{pct}%</span>
                    <span>{fmt(goal.currentAmount)} / {fmt(goal.targetAmount)} {currency}</span>
                  </div>
                </div>
              );
            })}
            {goals.filter((g) => g.status === 'active').length > 3 && (
              <button onClick={onViewAll} className="w-full text-center text-xs font-medium text-primary hover:underline">
                View all goals
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Recent Activity Card ──────────────────────────────────────────────────

import type { TaskResponse } from '@/types/task.types';
import type { TaskManagementLevel } from '@/types/onboarding.types';

function RecentActivityCard({
  taskLevel,
  currency,
  expenses,
  tasks,
  expensesLoading,
  onViewExpenses,
  onViewTasks,
}: {
  taskLevel: TaskManagementLevel;
  currency: string;
  expenses: ExpenseResponse[];
  tasks: TaskResponse[];
  expensesLoading: boolean;
  onViewExpenses: () => void;
  onViewTasks: () => void;
}) {
  const topExpenses = expenses.slice(0, 3);
  const pendingTasks = tasks.filter((t) => !t.isCompleted).slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expenses</p>
          {expensesLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : topExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No expenses this month.</p>
          ) : (
            topExpenses.map((expense) => (
              <div key={expense._id} className="flex items-center gap-2">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CATEGORY_CHIP_CLASSES[expense.category] ?? ''}`}>
                  {expense.category}
                </span>
                <span className="flex-1 truncate text-sm">{expense.description}</span>
                <span className="shrink-0 text-sm font-semibold">{fmt(expense.amount)} {currency}</span>
              </div>
            ))
          )}
          <button onClick={onViewExpenses} className="text-xs text-primary hover:underline">
            → See all expenses
          </button>
        </div>

        {taskLevel !== 'disabled' && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Tasks</p>
            {pendingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending tasks.</p>
            ) : (
              pendingTasks.map((task) => (
                <div key={task._id} className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded border-2 border-border" />
                  <span className="flex-1 text-sm">{task.title}</span>
                  {taskLevel === 'full' && task.assignedToNickname && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {task.assignedToNickname}
                    </span>
                  )}
                </div>
              ))
            )}
            <button onClick={onViewTasks} className="text-xs text-primary hover:underline">
              → See all tasks
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
