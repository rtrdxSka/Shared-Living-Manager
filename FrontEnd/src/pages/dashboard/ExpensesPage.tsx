import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw, Receipt, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useExpenses, useRecurringExpenses } from '@/hooks/queries';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import DashboardHeader from '@/components/layout/DashboardHeader';
import ExpenseFilterBar from '@/components/dashboard/shared/ExpenseFilterBar';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { CategoryChip } from '@/components/ui/category-chip';
import { Avatar } from '@/components/ui/avatar';
import { MoneyAmount } from '@/components/ui/money-amount';
import {
  fmt,
  stepMonth,
  formatMonthLabel,
  currentMonthString,
  getMyShareLabel,
  getBalanceSplitLabel,
} from '@/utils/dashboardHelpers';
import type { ExpenseResponse, ExpenseFilters } from '@/types/expense.types';
import { EMPTY_EXPENSE_FILTERS } from '@/types/expense.types';
import type { RecurringExpenseResponse } from '@/types/recurring-expense.types';
import { EXPENSE_TYPES, type ExpenseType } from '@/types/onboarding.types';

// ── Date formatter ────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ── Category bar colour map (static, no interpolation) ────────────────────

const CAT_BAR_CLASS: Record<ExpenseType, string> = {
  rent:          'bg-cat-rent',
  utilities:     'bg-cat-utilities',
  groceries:     'bg-cat-groceries',
  internet:      'bg-cat-internet',
  cleaning:      'bg-cat-cleaning',
  subscriptions: 'bg-cat-subscriptions',
  other:         'bg-cat-other',
};

function hasActiveFilters(f: ExpenseFilters): boolean {
  return (
    f.search.trim().length > 0 ||
    f.categories.length > 0 ||
    f.paidBy.length > 0 ||
    f.status !== null
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const {
    household,
    currentUserId,
    financeMode,
    splitMethod,
    customMyPct,
    setCustomMyPct,
    handleCustomPctCommit,
    incomeSplit,
    myNickname,
    partnerNickname,
    currency,
    myParticipatesInFinances,
    hasFinancialPartner,
    isAdmin,
    setAddExpenseOpen,
    setEditingExpense,
    deleteExpense,
    claimExpense,
    requestResolution,
    confirmResolution,
    disputeResolution,
    deactivateRecurringExpense,
  } = useDashboard();

  const [currentMonth, setCurrentMonth] = useState(currentMonthString);
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_EXPENSE_FILTERS);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [outstandingOpen, setOutstandingOpen] = useState(true);
  const [settledOpen, setSettledOpen] = useState(true);

  const {
    data: expensesData,
    isLoading: expensesLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useExpenses(household._id, currentMonth, filters);
  const expenses = useMemo(
    () => expensesData?.pages.flatMap((p) => p.items) ?? [],
    [expensesData]
  );

  const { data: recurringExpensesData, isLoading: recurringLoading } = useRecurringExpenses(
    household._id,
    true
  );
  const recurringExpenses = recurringExpensesData ?? [];

  const { unsettledExpenses, settledExpenses } = useMemo(() => {
    const unsettled: ExpenseResponse[] = [];
    const settled: ExpenseResponse[] = [];
    for (const e of expenses) {
      if (e.isResolved) settled.push(e);
      else unsettled.push(e);
    }
    return { unsettledExpenses: unsettled, settledExpenses: settled };
  }, [expenses]);

  const { splitBalance, catTotals, totalAmount } = useMemo(() => {
    // Net balance
    const unresolvedPaid = expenses.filter((e) => e.paidByUserId && !e.isResolved);
    const myPaidUnresolved = unresolvedPaid
      .filter((e) => e.paidByNickname === myNickname)
      .reduce((s, e) => s + e.amount, 0);
    const myShare = unresolvedPaid.reduce((s, e) => {
      if (e.isFullRepayment) {
        return s + (e.paidByNickname === myNickname ? 0 : e.amount);
      }
      const myPct = splitMethod === 'equal' ? 0.5 : splitMethod === 'income_based' && incomeSplit ? incomeSplit.myPct / 100 : customMyPct / 100;
      return s + e.amount * myPct;
    }, 0);
    const splitBalance = {
      unresolvedPaidCount: unresolvedPaid.length,
      balance: myPaidUnresolved - myShare,
    };

    // Category totals for right-rail breakdown
    const catTotals = Object.fromEntries(EXPENSE_TYPES.map((t) => [t, 0])) as Record<ExpenseType, number>;
    let totalAmount = 0;
    for (const e of expenses) {
      catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
      totalAmount += e.amount;
    }

    return {
      splitBalance,
      catTotals,
      totalAmount,
    };
  }, [expenses, myNickname, splitMethod, incomeSplit, customMyPct]);

  const maxCatTotal = Math.max(...Object.values(catTotals), 1);

  function toggleExpand(id: string) {
    setExpandedExpenseId((prev) => (prev === id ? null : id));
    setConfirmingDelete(null);
  }

  const headerSubtitle = `${formatMonthLabel(currentMonth)} · ${expenses.length} ${expenses.length === 1 ? 'entry' : 'entries'}${hasNextPage ? '+' : ''}`;

  return (
    <div className="min-h-screen bg-bg">
      {/* DashboardHeader */}
      <DashboardHeader title="Expenses" subtitle={headerSubtitle} />

      <div className="p-4 sm:p-6 space-y-6">
        {/* ── Top control row ────────────────────────────────────────── */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Month-nav pill */}
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-1 py-1">
            <button
              onClick={() => setCurrentMonth((m) => stepMonth(m, 'prev'))}
              className="rounded-full p-1.5 hover:bg-bg-sub text-ink-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-medium text-ink min-w-[8rem] text-center">
              {formatMonthLabel(currentMonth)}
            </span>
            <button
              onClick={() => setCurrentMonth((m) => stepMonth(m, 'next'))}
              className="rounded-full p-1.5 hover:bg-bg-sub text-ink-2"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Recurring ghost button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRecurringOpen((o) => !o)}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recurring
            {recurringExpenses.length > 0 && (
              <span className="rounded-full bg-surface-2 border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
                {recurringExpenses.length}
              </span>
            )}
          </Button>

          {/* Add expense primary */}
          <Button size="sm" onClick={() => setAddExpenseOpen(true)} className="ml-auto">
            + Add expense
          </Button>
        </div>

        {/* ── Recurring sheet (inline collapsible) ──────────────────── */}
        {recurringOpen && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <EyebrowLabel>RECURRING TEMPLATES</EyebrowLabel>
              <button
                onClick={() => setRecurringOpen(false)}
                className="rounded-full p-1 hover:bg-surface-2 text-ink-3"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <RecurringExpensesSection
              recurringExpenses={recurringExpenses}
              recurringLoading={recurringLoading}
              currency={currency}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDeactivate={deactivateRecurringExpense}
            />
          </Card>
        )}

        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <ExpenseFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          members={household.members}
        />

        {/* ── Split method callout ───────────────────────────────────── */}
        {financeMode === 'split' && (
          <SplitMethodCallout
            splitMethod={splitMethod}
            customMyPct={customMyPct}
            setCustomMyPct={setCustomMyPct}
            onCustomPctCommit={handleCustomPctCommit}
            incomeSplit={incomeSplit}
            myNickname={myNickname}
            partnerNickname={partnerNickname}
            isAdmin={isAdmin}
          />
        )}

        {/* ── Two-column layout ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Left column — main expense list ─────────────────────── */}
          <div className="space-y-4">
            {expensesLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-ink-3" />
              </div>
            ) : expenses.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No expenses yet"
                description={
                  hasActiveFilters(filters)
                    ? `No expenses match your filters for ${formatMonthLabel(currentMonth)}.`
                    : `No expenses for ${formatMonthLabel(currentMonth)}.`
                }
                action={
                  hasActiveFilters(filters)
                    ? undefined
                    : { label: 'Add expense', onClick: () => setAddExpenseOpen(true) }
                }
              />
            ) : (
              <>
                {/* Outstanding section */}
                <section>
                  <div className="rounded-xl border border-warn/30 bg-warn-bg/40 px-4 py-3 mb-3 flex items-center gap-3">
                    <EyebrowLabel className="text-warn">OUTSTANDING</EyebrowLabel>
                    <span className="text-sm text-ink-2">{unsettledExpenses.length} unsettled</span>
                    <span className="text-xs italic text-ink-3 ml-auto hidden sm:inline">Take your time</span>
                    <button
                      onClick={() => setOutstandingOpen((o) => !o)}
                      className="rounded-full p-1 hover:bg-warn/10 text-ink-2"
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', outstandingOpen && 'rotate-180')} />
                    </button>
                  </div>
                  {outstandingOpen && (
                    unsettledExpenses.length === 0 ? (
                      <p className="text-sm text-ink-3 italic py-2 px-1">All settled for this month.</p>
                    ) : (
                      <div className="space-y-2">
                        {unsettledExpenses.map((expense) => (
                          <ExpenseRow
                            key={expense._id}
                            expense={expense}
                            isExpanded={expandedExpenseId === expense._id}
                            isConfirmingDelete={confirmingDelete === expense._id}
                            onToggle={() => toggleExpand(expense._id)}
                            onStartDelete={() => setConfirmingDelete(expense._id)}
                            onCancelDelete={() => setConfirmingDelete(null)}
                            onConfirmDelete={async () => {
                              await deleteExpense(expense._id);
                              setConfirmingDelete(null);
                              setExpandedExpenseId(null);
                            }}
                            onEdit={() => { setEditingExpense(expense); setExpandedExpenseId(null); }}
                            onClaim={() => claimExpense(expense._id)}
                            onRequestResolution={() => requestResolution(expense._id)}
                            onConfirmResolution={() => confirmResolution(expense._id)}
                            onDisputeResolution={() => disputeResolution(expense._id)}
                            financeMode={financeMode}
                            splitMethod={splitMethod}
                            customMyPct={customMyPct}
                            incomeSplit={incomeSplit}
                            currency={currency}
                            currentUserId={currentUserId}
                            myNickname={myNickname}
                            partnerNickname={partnerNickname}
                            myParticipatesInFinances={myParticipatesInFinances}
                            hasFinancialPartner={hasFinancialPartner}
                          />
                        ))}
                      </div>
                    )
                  )}
                </section>

                {/* Settled section */}
                {settledExpenses.length > 0 && (
                  <section className="mt-2">
                    <div className="rounded-xl border border-pos/30 bg-pos/10 px-4 py-3 mb-3 flex items-center gap-3">
                      <EyebrowLabel className="text-pos">SETTLED</EyebrowLabel>
                      <span className="text-sm text-ink-2">{settledExpenses.length} cleared</span>
                      <span className="text-xs italic text-ink-3 ml-auto hidden sm:inline">Cleared this month</span>
                      <button
                        onClick={() => setSettledOpen((o) => !o)}
                        className="rounded-full p-1 hover:bg-pos/10 text-ink-2"
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', settledOpen && 'rotate-180')} />
                      </button>
                    </div>
                    {settledOpen && (
                      <div className="space-y-2">
                        {settledExpenses.map((expense) => (
                          <ExpenseRow
                            key={expense._id}
                            expense={expense}
                            isExpanded={expandedExpenseId === expense._id}
                            isConfirmingDelete={confirmingDelete === expense._id}
                            onToggle={() => toggleExpand(expense._id)}
                            onStartDelete={() => setConfirmingDelete(expense._id)}
                            onCancelDelete={() => setConfirmingDelete(null)}
                            onConfirmDelete={async () => {
                              await deleteExpense(expense._id);
                              setConfirmingDelete(null);
                              setExpandedExpenseId(null);
                            }}
                            onEdit={() => { setEditingExpense(expense); setExpandedExpenseId(null); }}
                            onClaim={() => claimExpense(expense._id)}
                            onRequestResolution={() => requestResolution(expense._id)}
                            onConfirmResolution={() => confirmResolution(expense._id)}
                            onDisputeResolution={() => disputeResolution(expense._id)}
                            financeMode={financeMode}
                            splitMethod={splitMethod}
                            customMyPct={customMyPct}
                            incomeSplit={incomeSplit}
                            currency={currency}
                            currentUserId={currentUserId}
                            myNickname={myNickname}
                            partnerNickname={partnerNickname}
                            myParticipatesInFinances={myParticipatesInFinances}
                            hasFinancialPartner={hasFinancialPartner}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Balance summary for split mode */}
                {financeMode === 'split' && myParticipatesInFinances && hasFinancialPartner && splitBalance.unresolvedPaidCount > 0 && (
                  <div className="mt-2 border-t border-line pt-3 text-sm">
                    <span className={splitBalance.balance > 0 ? 'text-pos' : 'text-warn'}>
                      {splitBalance.balance > 0
                        ? `${partnerNickname} owes you ${fmt(Math.abs(splitBalance.balance))} ${currency}`
                        : `You owe ${partnerNickname} ${fmt(Math.abs(splitBalance.balance))} ${currency}`}
                    </span>
                    <span className="text-ink-3"> · based on {getBalanceSplitLabel(splitMethod, customMyPct, incomeSplit)}</span>
                  </div>
                )}

                {/* Load-more footer */}
                {hasNextPage && (
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
                {!hasNextPage && expenses.length > 0 && (
                  <p className="text-center text-xs text-ink-3 py-2">No more expenses for {formatMonthLabel(currentMonth)}.</p>
                )}
              </>
            )}
          </div>

          {/* ── Right rail ────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Net Balance card */}
            {financeMode === 'split' && myParticipatesInFinances && hasFinancialPartner && (
              <Card className="p-5">
                <EyebrowLabel className="mb-3 block">NET BALANCE</EyebrowLabel>
                <div className="flex items-end gap-2 mb-1">
                  <MoneyAmount
                    amount={Math.abs(splitBalance.balance)}
                    currency={currency}
                    size="lg"
                    tone={splitBalance.balance >= 0 ? 'pos' : 'neg'}
                  />
                </div>
                <p className="text-xs text-ink-3 mt-1">
                  {splitBalance.balance > 0
                    ? `${partnerNickname} owes you`
                    : splitBalance.balance < 0
                    ? `You owe ${partnerNickname}`
                    : 'All settled up'}
                </p>
                <p className="text-[11px] text-ink-4 mt-1">{getBalanceSplitLabel(splitMethod, customMyPct, incomeSplit)}</p>
              </Card>
            )}

            {/* Category breakdown card */}
            <Card className="p-5">
              <EyebrowLabel className="mb-4 block">BY CATEGORY</EyebrowLabel>
              <div className="space-y-2.5">
                {EXPENSE_TYPES.map((cat) => {
                  const catTotal = catTotals[cat];
                  const pct = maxCatTotal > 0 ? (catTotal / maxCatTotal) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <CategoryChip category={cat} className="w-20 justify-center shrink-0" />
                      <div className="h-1.5 flex-1 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', CAT_BAR_CLASS[cat])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <MoneyAmount amount={catTotal} currency={currency} size="sm" className="shrink-0 w-20 text-right" />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Forecast card */}
            <Card className="p-5">
              <EyebrowLabel className="mb-3 block">FORECAST</EyebrowLabel>
              {totalAmount > 0 ? (
                <>
                  <p className="text-sm text-ink-2 mb-1">
                    Based on this month&apos;s pace, you&apos;re tracking approximately
                  </p>
                  <MoneyAmount amount={totalAmount * 1.1} currency={currency} size="lg" tone="neutral" />
                  <p className="text-xs text-ink-3 mt-1">if spending continues at current rate</p>
                </>
              ) : (
                <p className="text-sm text-ink-3 italic">No expenses logged yet this month.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Expense Row (expand-on-click) ─────────────────────────────────────────

interface ExpenseRowProps {
  expense: ExpenseResponse;
  isExpanded: boolean;
  isConfirmingDelete: boolean;
  onToggle: () => void;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onEdit: () => void;
  onClaim: () => Promise<void>;
  onRequestResolution: () => Promise<void>;
  onConfirmResolution: () => Promise<void>;
  onDisputeResolution: () => Promise<void>;
  financeMode: string;
  splitMethod: string;
  customMyPct: number;
  incomeSplit: { myPct: number; partnerPct: number } | null;
  currency: string;
  currentUserId: string;
  myNickname: string;
  partnerNickname: string;
  myParticipatesInFinances: boolean;
  hasFinancialPartner: boolean;
}

const ExpenseRow = React.memo(function ExpenseRow({
  expense,
  isExpanded,
  isConfirmingDelete,
  onToggle,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onClaim,
  onRequestResolution,
  onConfirmResolution,
  onDisputeResolution,
  financeMode,
  splitMethod,
  customMyPct,
  incomeSplit,
  currency,
  currentUserId,
  myNickname,
  partnerNickname,
  myParticipatesInFinances,
  hasFinancialPartner,
}: ExpenseRowProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const {
    isUnpaid,
    isDebtor,
    canClaim,
    canRequestResolution,
    canConfirmOrDispute,
    isAwaitingConfirmation,
    isCreditorWaiting,
    wasRecentlyDisputed,
    canEdit,
    canDelete,
  } = useMemo(() => {
    const isCreatorLocal = expense.createdByUserId === currentUserId;
    const isUnpaidLocal = !expense.paidByUserId;
    const isCreditorLocal = expense.paidByUserId === currentUserId;
    const isDebtorLocal = !isUnpaidLocal && !isCreditorLocal;
    const isSplitModeLocal = financeMode === 'split' && myParticipatesInFinances && hasFinancialPartner;
    const wasRecentlyDisputedLocal = !!(
      expense.lastDisputedAt &&
      Date.now() - new Date(expense.lastDisputedAt).getTime() < 24 * 60 * 60 * 1000
    );
    return {
      isUnpaid: isUnpaidLocal,
      isDebtor: isDebtorLocal,
      canClaim: isUnpaidLocal && myParticipatesInFinances,
      canRequestResolution:
        isSplitModeLocal && isDebtorLocal && !expense.isResolved && !expense.pendingConfirmation,
      canConfirmOrDispute:
        isSplitModeLocal && isCreditorLocal && expense.pendingConfirmation && !expense.isResolved,
      isAwaitingConfirmation:
        isSplitModeLocal && isDebtorLocal && expense.pendingConfirmation && !expense.isResolved,
      isCreditorWaiting:
        isSplitModeLocal &&
        isCreditorLocal &&
        !expense.pendingConfirmation &&
        !expense.isResolved &&
        !isUnpaidLocal,
      wasRecentlyDisputed: wasRecentlyDisputedLocal,
      canEdit: isCreatorLocal && !expense.isResolved && !expense.pendingConfirmation,
      canDelete: isCreatorLocal && !expense.isResolved && !expense.pendingConfirmation,
    };
  }, [
    expense.createdByUserId,
    expense.paidByUserId,
    expense.isResolved,
    expense.pendingConfirmation,
    expense.lastDisputedAt,
    currentUserId,
    financeMode,
    myParticipatesInFinances,
    hasFinancialPartner,
  ]);

  async function handleAction(action: () => Promise<void>, key: string) {
    setActionLoading(key);
    try { await action(); } finally { setActionLoading(null); }
  }

  return (
    <div className={cn('rounded-xl border border-line bg-surface overflow-hidden transition-colors', isExpanded && 'border-line-2')}>
      {/* Collapsed summary row */}
      <div
        onClick={onToggle}
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:border-line-2',
          isExpanded && 'bg-surface-2'
        )}
      >
        <CategoryChip category={expense.category} />
        {expense.recurringExpenseId && (
          <RefreshCw className="h-3.5 w-3.5 text-ink-3 shrink-0" aria-label="Recurring" />
        )}
        <span className="flex-1 min-w-0 truncate text-sm text-ink">{expense.description}</span>
        {!expense.paidByNickname && (
          <span className="shrink-0 rounded-full bg-warn-bg border border-warn/30 px-2 py-0.5 text-[11px] font-medium text-warn">
            Unpaid
          </span>
        )}
        {expense.pendingConfirmation && !expense.isResolved && (
          <span className="shrink-0 rounded-full bg-warn-bg border border-warn/30 px-2 py-0.5 text-[11px] font-medium text-warn">
            Pending
          </span>
        )}
        <span className="text-xs text-ink-3 hidden sm:inline shrink-0">Paid by</span>
        {expense.paidByNickname && (
          <Avatar name={expense.paidByNickname} size={24} className="shrink-0" />
        )}
        <span className="text-[11px] font-mono text-ink-3 hidden md:inline shrink-0">
          {formatDate(expense.date)}
        </span>
        <MoneyAmount amount={expense.amount} currency={currency} size="sm" className="shrink-0 font-semibold" />
        <ChevronDown className={cn('h-4 w-4 text-ink-3 transition-transform shrink-0', isExpanded && 'rotate-180')} />
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="border-t border-line bg-surface-2 px-4 py-4 space-y-4">
          {/* Details grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <span className="text-ink-3">Paid by</span>
            <span className="text-ink">{expense.paidByNickname ?? 'Not yet claimed'}</span>
            {expense.notes && (
              <>
                <span className="text-ink-3">Notes</span>
                <span className="text-ink text-sm">{expense.notes}</span>
              </>
            )}
            {expense.isFullRepayment && (
              <>
                <span className="text-ink-3">Split</span>
                <span className="rounded-full bg-warn-bg border border-warn/30 px-2 py-0.5 text-[11px] font-medium text-warn w-fit">Full repayment</span>
              </>
            )}
            {financeMode === 'split' && myParticipatesInFinances && expense.paidByUserId && (
              <>
                <span className="text-ink-3">Your share</span>
                <span className="text-ink">{getMyShareLabel(expense, splitMethod, customMyPct, incomeSplit, currency, myNickname)}</span>
              </>
            )}
          </div>

          {/* Status hints */}
          {expense.isResolved && (
            <p className="text-xs text-pos">✓ Share settled</p>
          )}
          {isUnpaid && (
            <p className="text-xs text-warn">
              No payer assigned yet. Claim this expense if you paid for it.
            </p>
          )}
          {isAwaitingConfirmation && (
            <p className="text-xs text-warn">
              Waiting for {partnerNickname} to confirm they received your payment.
            </p>
          )}
          {isCreditorWaiting && (
            <p className="text-xs text-ink-3">
              Waiting for {partnerNickname} to confirm they paid you back.
            </p>
          )}
          {canConfirmOrDispute && (
            <p className="text-xs text-warn font-medium">
              {expense.pendingConfirmationByNickname ?? partnerNickname} says they paid you back.
            </p>
          )}
          {isDebtor && wasRecentlyDisputed && !expense.pendingConfirmation && (
            <p className="text-xs text-warn">
              {partnerNickname} disputed your payment claim. Sort it out and try again.
            </p>
          )}

          {/* Action buttons */}
          {!isConfirmingDelete ? (
            <div className="flex flex-wrap gap-2">
              {canClaim && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading === 'claim'}
                  onClick={() => void handleAction(onClaim, 'claim')}
                >
                  {actionLoading === 'claim' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Claim expense'}
                </Button>
              )}
              {canRequestResolution && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading === 'request'}
                  onClick={() => void handleAction(onRequestResolution, 'request')}
                >
                  {actionLoading === 'request' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'I paid you back'}
                </Button>
              )}
              {isAwaitingConfirmation && (
                <Button size="sm" variant="outline" disabled className="opacity-60 cursor-not-allowed">
                  Awaiting confirmation…
                </Button>
              )}
              {canConfirmOrDispute && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-pos/50 text-pos hover:bg-pos/10 hover:border-pos"
                    disabled={actionLoading === 'confirm'}
                    onClick={() => void handleAction(onConfirmResolution, 'confirm')}
                  >
                    {actionLoading === 'confirm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm received'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                    disabled={actionLoading === 'dispute'}
                    onClick={() => void handleAction(onDisputeResolution, 'dispute')}
                  >
                    {actionLoading === 'dispute' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Dispute'}
                  </Button>
                </>
              )}
              {canEdit && (
                <Button size="sm" variant="outline" onClick={onEdit}>
                  Edit expense
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                  onClick={onStartDelete}
                >
                  Delete expense
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-3">Delete this expense?</span>
              <Button
                size="sm"
                variant="destructive"
                disabled={actionLoading === 'delete'}
                onClick={() => void handleAction(onConfirmDelete, 'delete')}
              >
                {actionLoading === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Yes, delete'}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelDelete}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── Split Method Callout ──────────────────────────────────────────────────

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
  splitMethod: string;
  customMyPct: number;
  setCustomMyPct: (v: number) => void;
  onCustomPctCommit: (v: number) => Promise<void>;
  incomeSplit: { myPct: number; partnerPct: number } | null;
  myNickname: string;
  partnerNickname: string;
  isAdmin: boolean;
}) {
  return (
    <Card className="p-4">
      {splitMethod === 'equal' && (
        <p className="text-sm text-ink-2">
          Expenses are split <strong className="text-ink">50/50</strong> equally between both partners.
        </p>
      )}
      {splitMethod === 'income_based' && incomeSplit && (
        <div className="space-y-3">
          <p className="text-sm text-ink">Income-based split — feels fairer this way</p>
          <div>
            <div className="flex justify-between text-xs text-ink-3 mb-1">
              <span>{myNickname} {incomeSplit.myPct}%</span>
              <span>{partnerNickname} {incomeSplit.partnerPct}%</span>
            </div>
            <div className="flex h-2 w-full rounded-full overflow-hidden">
              <div className="bg-accent" style={{ width: `${incomeSplit.myPct}%` }} />
              <div className="bg-cat-rent" style={{ width: `${incomeSplit.partnerPct}%` }} />
            </div>
          </div>
        </div>
      )}
      {splitMethod === 'income_based' && !incomeSplit && (
        <p className="text-sm text-ink-2">
          Income data is incomplete — enter income on the Overview page to see the split.
        </p>
      )}
      {splitMethod === 'custom' && (
        <div className="space-y-3">
          <p className="text-sm text-ink">Custom split — set by you</p>
          {isAdmin ? (
            <>
              <div>
                <div className="flex justify-between text-xs text-ink-3 mb-1">
                  <span>{myNickname} {customMyPct}%</span>
                  <span>{partnerNickname} {100 - customMyPct}%</span>
                </div>
                <div className="flex h-2 w-full rounded-full overflow-hidden">
                  <div className="bg-accent" style={{ width: `${customMyPct}%` }} />
                  <div className="bg-cat-rent" style={{ width: `${100 - customMyPct}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={99}
                  step={1}
                  value={customMyPct}
                  onChange={(e) => setCustomMyPct(Number(e.target.value))}
                  onMouseUp={(e) => void onCustomPctCommit(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => void onCustomPctCommit(Number((e.target as HTMLInputElement).value))}
                  className="flex-1 accent-primary"
                />
              </div>
            </>
          ) : (
            <p className="text-ink-3 text-xs">{myNickname} {customMyPct}% · {partnerNickname} {100 - customMyPct}% (admin only)</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Recurring Expenses Section ────────────────────────────────────────────

function RecurringExpensesSection({
  recurringExpenses,
  recurringLoading,
  currency,
  currentUserId,
  isAdmin,
  onDeactivate,
}: {
  recurringExpenses: RecurringExpenseResponse[];
  recurringLoading: boolean;
  currency: string;
  currentUserId: string;
  isAdmin: boolean;
  onDeactivate: (id: string) => Promise<void>;
}) {
  if (recurringLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-ink-3" />
      </div>
    );
  }

  if (recurringExpenses.length === 0) {
    return <p className="text-xs text-ink-3">No active recurring templates.</p>;
  }

  return (
    <div className="space-y-2">
      {recurringExpenses.map((t) => (
        <div key={t._id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <CategoryChip category={t.category} />
          <span className="flex-1 truncate text-sm text-ink">{t.description}</span>
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-3 capitalize">
            {t.interval}
          </span>
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-3">
            {t.payerMode === 'fixed' ? (t.fixedPayerNickname ?? 'Fixed') : 'Open'}
          </span>
          <MoneyAmount amount={t.amount} currency={currency} size="sm" className="shrink-0 font-semibold" />
          {(t.createdByUserId === currentUserId || isAdmin) && (
            <button
              onClick={() => void onDeactivate(t._id)}
              className="shrink-0 rounded-full p-1.5 text-ink-3 hover:bg-surface hover:text-neg transition-colors"
              title="Deactivate"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
