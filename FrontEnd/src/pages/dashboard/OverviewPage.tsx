import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useExpenses, useJointAccountSummary } from '@/hooks/queries';
import IncomeEntryCard from '@/components/dashboard/shared/IncomeEntryCard';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { HeroNumberCard } from '@/components/ui/hero-number-card';
import { Donut } from '@/components/ui/donut';
import { MoneyAmount } from '@/components/ui/money-amount';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { CategoryChip } from '@/components/ui/category-chip';
import { Avatar } from '@/components/ui/avatar';
import { SparkBars } from '@/components/ui/spark-bars';
import {
  fmt,
  getDueDateStatus,
  currentMonthString,
  stepMonth,
  formatMonthLabel,
} from '@/utils/dashboardHelpers';
import type { ExpenseResponse } from '@/types/expense.types';
import type { HouseholdResponse } from '@/types/household.types';
import type { JointAccountSummaryResponse } from '@/types/joint-account.types';
import type { GoalResponse } from '@/types/goal.types';
import type { TaskResponse } from '@/types/task.types';
import type { TaskManagementLevel } from '@/types/onboarding.types';

type ViewMode = 'current' | 'month' | 'all';

const KNOWN_CATEGORIES = new Set(['rent', 'utilities', 'groceries', 'internet', 'other']);
function categoryKey(c: string): 'rent' | 'utilities' | 'groceries' | 'internet' | 'other' {
  return KNOWN_CATEGORIES.has(c) ? (c as 'rent' | 'utilities' | 'groceries' | 'internet' | 'other') : 'other';
}

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
    setAddGoalOpen,
    setAddTransactionOpen,
    splitMethod: _splitMethod,
  } = useDashboard();

  const [viewMode, setViewMode] = useState<ViewMode>('current');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString);

  const effectiveMonth =
    viewMode === 'current' ? currentMonthString() :
    viewMode === 'month'   ? selectedMonth         : 'all';

  const { data: expensesData, isLoading: expensesLoading } = useExpenses(household._id, effectiveMonth);
  const expenses = useMemo(
    () => expensesData?.pages.flatMap((p) => p.items) ?? [],
    [expensesData]
  );

  const { data: jointAccountData } = useJointAccountSummary(
    household._id,
    effectiveMonth,
    financeMode === 'joint' && effectiveMonth !== 'all'
  );
  const jointAccount = jointAccountData ?? null;

  const showIncomeCard = splitMethod === 'income_based' && myParticipatesInFinances;

  return (
    <div className="pb-8">
      <DashboardHeader
        title="Overview"
        subtitle={`${myNickname} & ${partnerNickname} · ${household.name}`}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {showIncomeCard && (
          <IncomeEntryCard household={household} currentUserId={currentUserId} />
        )}

        {/* Period filter */}
        <div className="flex items-center flex-wrap gap-2 ">
          {(['current', 'month', 'all'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {mode === 'current' ? 'This Month' : mode === 'month' ? 'Month' : 'All Time'}
            </button>
          ))}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setSelectedMonth((m) => stepMonth(m, 'prev'))}
                className="rounded p-1 hover:bg-surface-2 text-ink-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium min-w-[110px] text-center text-ink">
                {formatMonthLabel(selectedMonth)}
              </span>
              <button
                onClick={() => setSelectedMonth((m) => stepMonth(m, 'next'))}
                className="rounded p-1 hover:bg-surface-2 text-ink-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

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
          currentMonth={effectiveMonth}
          household={household}
          tasks={tasks}
          taskLevel={taskLevel}
          jointAccount={jointAccount}
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

        {/* Friendly nudge */}

      </div>
    </div>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────

interface StatsRowProps {
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
  household: HouseholdResponse;
  tasks: TaskResponse[];
  taskLevel: TaskManagementLevel;
  jointAccount: JointAccountSummaryResponse | null;
}

const StatsRow = React.memo(function StatsRow({
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
  tasks,
  taskLevel,
  jointAccount,
}: StatsRowProps) {


  const { totalAmount, myPaidTotal, partnerPaidTotal } = useMemo(() => {
    const paidExpenses = expenses.filter((e) => e.paidByUserId);
    const total = paidExpenses.reduce((s, e) => s + e.amount, 0);
    const myPaid = paidExpenses
      .filter((e) => e.paidByNickname === myNickname)
      .reduce((s, e) => s + e.amount, 0);
    return {
      totalAmount: total,
      myPaidTotal: myPaid,
      partnerPaidTotal: total - myPaid,
    };
  }, [expenses, myNickname]);

  const { balance, balancePositive } = useMemo(() => {
    const unresolvedPaid = expenses.filter((e) => e.paidByUserId && !e.isResolved);
    const myUnresolvedPaid = unresolvedPaid
      .filter((e) => e.paidByNickname === myNickname)
      .reduce((s, e) => s + e.amount, 0);
    const myShare = unresolvedPaid.reduce((s, e) => {
      if (e.isFullRepayment) {
        return s + (e.paidByNickname === myNickname ? 0 : e.amount);
      }
      const myPct = splitMethod === 'equal' ? 0.5 : splitMethod === 'income_based' && incomeSplit ? incomeSplit.myPct / 100 : customMyPct / 100;
      return s + e.amount * myPct;
    }, 0);
    const b = myUnresolvedPaid - myShare;
    return { balance: b, balancePositive: b > 0 };
  }, [expenses, myNickname, splitMethod, incomeSplit, customMyPct]);

  // Spark bars: last 6 expense amounts (or zeros if fewer)
  const sparkValues = useMemo(() => {
    const amounts = expenses.slice(-6).map((e) => e.amount);
    while (amounts.length < 6) amounts.unshift(0);
    return amounts;
  }, [expenses]);

  // Open tasks count
  const openCount = useMemo(() => tasks.filter((t) => !t.isCompleted).length, [tasks]);
  const overdueCount = useMemo(
    () => tasks.filter((t) => !t.isCompleted && getDueDateStatus(t.dueDate, t.isCompleted) === 'overdue').length,
    [tasks]
  );

  // Task urgency mini-bars (4 bars): red=overdue, yellow=due-today, gray=upcoming, gray=none
  const urgencyBars = useMemo(() => {
    const pending = tasks.filter((t) => !t.isCompleted);
    const counts = { overdue: 0, today: 0, upcoming: 0, none: 0 };
    pending.forEach((t) => {
      const s = getDueDateStatus(t.dueDate, t.isCompleted);
      if (s === 'overdue') counts.overdue++;
      else if (s === 'due-today') counts.today++;
      else if (s === 'upcoming') counts.upcoming++;
      else counts.none++;
    });
    return counts;
  }, [tasks]);

  const sublineLabel =
    splitMethod === 'equal' ? '50/50 split' :
    splitMethod === 'income_based' && incomeSplit ? `${incomeSplit.myPct}/${incomeSplit.partnerPct} income-based` :
    splitMethod === 'income_based' ? 'income-based (data incomplete)' :
    `${customMyPct}/${100 - customMyPct} custom`;

  // ── All-time view ──────────────────────────────────────────────────────
  if (currentMonth === 'all') {
    return (
      <div className="space-y-4">
        <HeroNumberCard
          eyebrow={<EyebrowLabel>ALL TIME</EyebrowLabel>}
          hero={<MoneyAmount amount={totalAmount} currency={currency} size="hero" tone="neutral" />}
          subline={<span className="text-sm text-ink-3">{expenses.length} expenses</span>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatTile
            eyebrow="TOTAL SPENT"
            hero={<MoneyAmount amount={totalAmount} currency={currency} size="lg" />}
          />
          <StatTile
            eyebrow="EXPENSES"
            hero={<p className="text-2xl font-semibold text-ink num">{expenses.length}</p>}
            sub="all time"
          />
        </div>
      </div>
    );
  }

  // ── Joint mode ─────────────────────────────────────────────────────────
  if (financeMode === 'joint') {
    const colCount = taskLevel !== 'disabled' ? 3 : 2;
    return (
      <div className="space-y-4">
        <HeroNumberCard
          eyebrow={<EyebrowLabel>TOTAL SPENT THIS MONTH</EyebrowLabel>}
          hero={<MoneyAmount amount={totalAmount} currency={currency} size="hero" tone="neutral" />}
          subline={<span className="text-sm text-ink-3">{expenses.length} expenses</span>}
        />
        <div className={`grid grid-cols-1 ${colCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
          <StatTile
            eyebrow="SPENT THIS MONTH"
            hero={<MoneyAmount amount={totalAmount} currency={currency} size="lg" />}
            below={<SparkBars values={sparkValues} highlightLast className="mt-3" />}
          />
          {jointAccount ? (
            <JointAccountTile jointAccount={jointAccount} currency={currency} />
          ) : (
            <StatTile
              eyebrow="PER PERSON"
              hero={<MoneyAmount amount={totalAmount / 2} currency={currency} size="lg" />}
              sub="each"
            />
          )}
          {taskLevel !== 'disabled' && (
            <OpenTasksTile openCount={openCount} overdueCount={overdueCount} urgencyBars={urgencyBars} />
          )}
        </div>
      </div>
    );
  }

  // ── Not participating / no partner ─────────────────────────────────────
  if (!myParticipatesInFinances || !hasFinancialPartner) {
    const note = !myParticipatesInFinances
      ? 'You are not part of the shared finances.'
      : 'No financial partner found.';
    return (
      <div className="space-y-4">
        <HeroNumberCard
          eyebrow={<EyebrowLabel>SPENT THIS MONTH</EyebrowLabel>}
          hero={<MoneyAmount amount={totalAmount} currency={currency} size="hero" tone="neutral" />}
          subline={<span className="text-sm text-ink-3">{expenses.length} expenses</span>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatTile
            eyebrow="SPENT THIS MONTH"
            hero={<MoneyAmount amount={totalAmount} currency={currency} size="lg" />}
            below={<SparkBars values={sparkValues} highlightLast className="mt-3" />}
          />
          <StatTile
            eyebrow="EXPENSES"
            hero={<p className="text-2xl font-semibold text-ink num">{expenses.length}</p>}
            sub={note}
          />
        </div>
      </div>
    );
  }

  // ── Split mode: hero balance card ──────────────────────────────────────
  const heroContent = balancePositive ? (
    <>
      <p className="text-2xl text-ink-2 leading-tight">
        <span className="font-serif italic text-accent">{partnerNickname}</span> owes you
      </p>
      <MoneyAmount amount={Math.abs(balance)} currency={currency} size="hero" tone="neutral" />
    </>
  ) : (
    <>
      <p className="text-2xl text-ink-2 leading-tight">
        You owe <span className="font-serif italic text-accent">{partnerNickname}</span>
      </p>
      <MoneyAmount amount={Math.abs(balance)} currency={currency} size="hero" tone="neutral" />
    </>
  );



  const donutRightSlot = (
    <Donut
      size={130}
      segments={[
        { value: myPaidTotal, color: 'hsl(var(--accent))' },
        { value: partnerPaidTotal, color: 'hsl(var(--cat-rent))' },
      ]}
      centerLabel={<MoneyAmount amount={totalAmount} currency={currency} size="md" tone="neutral" />}
      centerSubLabel={
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">this month</span>
      }
    />
  );

  const colCount = taskLevel !== 'disabled' ? 3 : 2;

  return (
    <div className="space-y-4">
      <HeroNumberCard
        eyebrow={<EyebrowLabel>THE CURRENT STATE OF THINGS</EyebrowLabel>}
        hero={<div className="space-y-2">{heroContent}</div>}
        subline={<span className="text-sm text-ink-3">{sublineLabel}</span>}
        
        rightSlot={donutRightSlot}
      />

      <div className={`grid grid-cols-1 ${colCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
        <StatTile
          eyebrow="SPENT THIS MONTH"
          hero={<MoneyAmount amount={totalAmount} currency={currency} size="lg" />}
          below={<SparkBars values={sparkValues} highlightLast className="mt-3" />}
        />
        <StatTile
          eyebrow="PER PERSON"
          hero={<MoneyAmount amount={totalAmount / 2} currency={currency} size="lg" />}
          sub="each"
        />
        {taskLevel !== 'disabled' && (
          <OpenTasksTile openCount={openCount} overdueCount={overdueCount} urgencyBars={urgencyBars} />
        )}
      </div>
    </div>
  );
});

// ── Stat Tile ─────────────────────────────────────────────────────────────

function StatTile({
  eyebrow,
  hero,
  sub,
  below,
}: {
  eyebrow: string;
  hero: React.ReactNode;
  sub?: string;
  below?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <EyebrowLabel as="div" className="mb-2">{eyebrow}</EyebrowLabel>
        {hero}
        {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
        {below}
      </CardContent>
    </Card>
  );
}

// ── Joint Account Tile ─────────────────────────────────────────────────────

function JointAccountTile({
  jointAccount,
  currency,
}: {
  jointAccount: JointAccountSummaryResponse;
  currency: string;
}) {
  const pct = jointAccount.monthlyTarget && jointAccount.monthlyTarget > 0
    ? Math.min(100, (jointAccount.monthlyDeposits / jointAccount.monthlyTarget) * 100)
    : null;

  return (
    <Card>
      <CardContent className="p-5">
        <EyebrowLabel as="div" className="mb-2">JOINT ACCOUNT</EyebrowLabel>
        <MoneyAmount amount={jointAccount.balance} currency={currency} size="lg" />
        {jointAccount.monthlyTarget != null && (
          <>
            <p className="mt-1 text-xs text-ink-3">
              {fmt(jointAccount.monthlyDeposits)} of {fmt(jointAccount.monthlyTarget)} deposited this month
            </p>
            {pct !== null && (
              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden mt-3">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Open Tasks Tile ────────────────────────────────────────────────────────

function OpenTasksTile({
  openCount,
  overdueCount,
  urgencyBars,
}: {
  openCount: number;
  overdueCount: number;
  urgencyBars: { overdue: number; today: number; upcoming: number; none: number };
}) {
  const maxBar = Math.max(urgencyBars.overdue, urgencyBars.today, urgencyBars.upcoming, urgencyBars.none, 1);
  const bars = [
    { h: (urgencyBars.overdue / maxBar) * 28, color: 'bg-neg' },
    { h: (urgencyBars.today / maxBar) * 28, color: 'bg-warn' },
    { h: (urgencyBars.upcoming / maxBar) * 28, color: 'bg-line-2' },
    { h: (urgencyBars.none / maxBar) * 28, color: 'bg-line-2' },
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <EyebrowLabel as="div" className="mb-2">OPEN TASKS</EyebrowLabel>
        <p className="text-2xl font-semibold text-ink num">{openCount}</p>
        {overdueCount > 0 && (
          <p className="mt-1 text-xs text-neg">{overdueCount} overdue</p>
        )}
        {overdueCount === 0 && (
          <p className="mt-1 text-xs text-ink-3">all on track</p>
        )}
        <div className="flex items-end gap-1 mt-3" style={{ height: 28 }} aria-hidden>
          {bars.map((bar, i) => (
            <div
              key={i}
              className={`rounded-sm shrink-0 ${bar.color}`}
              style={{ width: 12, height: Math.max(2, bar.h) }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Joint Account Overview Card ───────────────────────────────────────────

interface JointAccountOverviewCardProps {
  jointAccount: JointAccountSummaryResponse;
  currency: string;
  onViewAccount: () => void;
  onAddFunds: () => void;
}

const JointAccountOverviewCard = React.memo(function JointAccountOverviewCard({
  jointAccount,
  currency,
  onViewAccount,
  onAddFunds,
}: JointAccountOverviewCardProps) {
  const pct = jointAccount.monthlyTarget && jointAccount.monthlyTarget > 0
    ? Math.min(100, (jointAccount.monthlyDeposits / jointAccount.monthlyTarget) * 100)
    : null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <EyebrowLabel as="div">JOINT ACCOUNT BALANCE</EyebrowLabel>
            <MoneyAmount amount={jointAccount.balance} currency={currency} size="lg" tone="auto" />
            {jointAccount.monthlyTarget != null && (
              <div>
                <EyebrowLabel as="div" className="mb-1">DEPOSITS THIS MONTH</EyebrowLabel>
                <MoneyAmount amount={jointAccount.monthlyDeposits} currency={currency} size="md" />
                <span className="text-sm text-ink-3"> / </span>
                <MoneyAmount amount={jointAccount.monthlyTarget} currency={currency} size="md" />
                {pct !== null && (
                  <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="default" size="sm" onClick={onAddFunds}>
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
});

// ── Goals Preview Card ────────────────────────────────────────────────────

interface GoalsPreviewCardProps {
  goals: GoalResponse[];
  goalsLoading: boolean;
  currency: string;
  onAddGoal: () => void;
  onViewAll: () => void;
}

const GoalsPreviewCard = React.memo(function GoalsPreviewCard({
  goals,
  goalsLoading,
  currency,
  onAddGoal,
  onViewAll,
}: GoalsPreviewCardProps) {
  const { activeGoals, hasMoreActive } = useMemo(() => {
    const active = goals.filter((g) => g.status === 'active');
    return { activeGoals: active.slice(0, 3), hasMoreActive: active.length > 3 };
  }, [goals]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-ink">Saving towards</h3>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onAddGoal}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {goalsLoading && activeGoals.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-ink-3" />
          </div>
        ) : activeGoals.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-3">No active goals yet</p>
        ) : (
          <div className="space-y-4">
            {activeGoals.map((goal) => {
              const pct = goal.targetAmount > 0
                ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
                : 0;
              return (
                <div key={goal._id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{goal.name}</span>
                    {goal.deadline && (
                      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3 shrink-0">
                        {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-3">
                    <span>{pct}%</span>
                    <span>
                      <MoneyAmount amount={goal.currentAmount} currency={currency} size="sm" /> / <MoneyAmount amount={goal.targetAmount} currency={currency} size="sm" />
                    </span>
                  </div>
                </div>
              );
            })}
            {hasMoreActive && (
              <button onClick={onViewAll} className="w-full text-center text-xs font-medium text-accent hover:underline mt-2">
                View all goals
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ── Recent Activity Card ──────────────────────────────────────────────────

interface RecentActivityCardProps {
  taskLevel: TaskManagementLevel;
  currency: string;
  expenses: ExpenseResponse[];
  tasks: TaskResponse[];
  expensesLoading: boolean;
  onViewExpenses: () => void;
  onViewTasks: () => void;
}

const RecentActivityCard = React.memo(function RecentActivityCard({
  taskLevel,
  currency,
  expenses,
  tasks,
  expensesLoading,
  onViewExpenses,
  onViewTasks,
}: RecentActivityCardProps) {
  const topExpenses = useMemo(() => expenses.slice(0, 3), [expenses]);
  const pendingTasks = useMemo(
    () => tasks.filter((t) => !t.isCompleted).slice(0, 2),
    [tasks]
  );

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <h3 className="text-base font-semibold text-ink">Recent activity</h3>

        {/* Expenses subsection */}
        <div className="space-y-1">
          <EyebrowLabel as="div" className="mb-2">EXPENSES</EyebrowLabel>
          {expensesLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-ink-3" />
          ) : topExpenses.length === 0 ? (
            <p className="text-xs text-ink-3">No expenses this period.</p>
          ) : (
            topExpenses.map((expense) => (
              <div key={expense._id} className="flex items-center gap-3 py-2">
                <CategoryChip category={categoryKey(expense.category)} />
                <span className="flex-1 truncate text-sm text-ink">{expense.description}</span>
                <MoneyAmount amount={expense.amount} currency={currency} size="sm" />
              </div>
            ))
          )}
          <button onClick={onViewExpenses} className="text-xs text-accent hover:underline mt-1 block">
            → See all expenses
          </button>
        </div>

        {/* Pending tasks subsection */}
        {taskLevel !== 'disabled' && (
          <div className="space-y-1">
            <EyebrowLabel as="div" className="mb-2">PENDING TASKS</EyebrowLabel>
            {pendingTasks.length === 0 ? (
              <p className="text-xs text-ink-3">No pending tasks.</p>
            ) : (
              pendingTasks.map((task) => (
                <div key={task._id} className="flex items-center gap-3 py-2">
                  <div className="h-4 w-4 rounded-sm border-2 border-line shrink-0" />
                  <span className="flex-1 text-sm text-ink">{task.title}</span>
                  {taskLevel === 'full' && task.assignedToNickname ? (
                    <Avatar name={task.assignedToNickname} size={24} />
                  ) : !task.assignedToNickname ? (
                    <span className="rounded-full bg-accent/20 text-accent-ink px-2 py-0.5 text-[10px] font-medium">
                      Up for grabs
                    </span>
                  ) : null}
                </div>
              ))
            )}
            <button onClick={onViewTasks} className="text-xs text-accent hover:underline mt-1 block">
              → See all tasks
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
