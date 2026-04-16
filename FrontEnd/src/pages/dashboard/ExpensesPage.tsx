import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Loader2, RefreshCw, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useExpenses, useRecurringExpenses } from '@/hooks/queries';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import {
  fmt,
  stepMonth,
  formatMonthLabel,
  currentMonthString,
  CATEGORY_CHIP_CLASSES,
  getMyShareLabel,
  getBalanceSplitLabel,
} from '@/utils/dashboardHelpers';
import type { ExpenseResponse } from '@/types/expense.types';
import type { RecurringExpenseResponse } from '@/types/recurring-expense.types';
import { EXPENSE_TYPES } from '@/types/onboarding.types';
import type { ExpenseType } from '@/types/onboarding.types';

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
    resolveExpense,
    deactivateRecurringExpense,
  } = useDashboard();

  const [currentMonth, setCurrentMonth] = useState(currentMonthString);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseType | 'all'>('all');
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const { data: expensesData, isLoading: expensesLoading } = useExpenses(household._id, currentMonth);
  const expenses = expensesData?.expenses ?? [];

  const { data: recurringExpensesData, isLoading: recurringLoading } = useRecurringExpenses(
    household._id,
    true
  );
  const recurringExpenses = recurringExpensesData ?? [];

  const displayedExpenses =
    categoryFilter === 'all' ? expenses : expenses.filter((e) => e.category === categoryFilter);

  function toggleExpand(id: string) {
    setExpandedExpenseId((prev) => (prev === id ? null : id));
    setConfirmingDelete(null);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Expenses</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track and manage shared expenses
          </p>
        </div>
        <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <Card>
        {/* Month navigation + filter */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentMonth((m) => stepMonth(m, 'prev'))}
                className="rounded p-1 hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <CardTitle className="text-base font-semibold">
                {formatMonthLabel(currentMonth)}
              </CardTitle>
              <button
                onClick={() => setCurrentMonth((m) => stepMonth(m, 'next'))}
                className="rounded p-1 hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(['all', ...EXPENSE_TYPES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat as ExpenseType | 'all')}
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
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Split method callout */}
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

          {expensesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayedExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description={`No ${categoryFilter !== 'all' ? categoryFilter + ' ' : ''}expenses for ${formatMonthLabel(currentMonth)}.`}
              action={categoryFilter === 'all' ? { label: 'Add expense', onClick: () => setAddExpenseOpen(true) } : undefined}
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground italic">
                Tap any expense to see details and available actions.
              </p>
              <div className="space-y-2">
                {displayedExpenses.map((expense) => (
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
                    onResolve={() => resolveExpense(expense._id)}
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

              {/* Balance summary for split mode */}
              {financeMode === 'split' && myParticipatesInFinances && hasFinancialPartner && (() => {
                const unresolvedPaid = expenses.filter((e) => e.paidByUserId && !e.isResolved);
                const myPaidUnresolved = unresolvedPaid.filter((e) => e.paidByNickname === myNickname).reduce((s, e) => s + e.amount, 0);
                const myShare = unresolvedPaid.reduce((s, e) => {
                  if (e.isFullRepayment) {
                    return s + (e.paidByNickname === myNickname ? 0 : e.amount);
                  }
                  const myPct = splitMethod === 'equal' ? 0.5 : splitMethod === 'income_based' && incomeSplit ? incomeSplit.myPct / 100 : customMyPct / 100;
                  return s + e.amount * myPct;
                }, 0);
                const balance = myPaidUnresolved - myShare;
                if (unresolvedPaid.length === 0) return null;
                return (
                  <div className="mt-2 border-t border-border pt-3 text-sm">
                    <span className={balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                      {balance > 0
                        ? `${partnerNickname} owes you ${fmt(Math.abs(balance))} ${currency}`
                        : `You owe ${partnerNickname} ${fmt(Math.abs(balance))} ${currency}`}
                    </span>
                    <span className="text-muted-foreground"> · based on {getBalanceSplitLabel(splitMethod, customMyPct, incomeSplit)}</span>
                  </div>
                );
              })()}
            </>
          )}

          {/* Recurring Templates */}
          <div className="border-t border-border pt-3">
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
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', recurringOpen && 'rotate-180')} />
            </button>

            {recurringOpen && (
              <RecurringExpensesSection
                recurringExpenses={recurringExpenses}
                recurringLoading={recurringLoading}
                currency={currency}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onDeactivate={deactivateRecurringExpense}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Expense Row (expand-on-click) ─────────────────────────────────────────

function ExpenseRow({
  expense,
  isExpanded,
  isConfirmingDelete,
  onToggle,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onClaim,
  onResolve,
  financeMode,
  splitMethod,
  customMyPct,
  incomeSplit,
  currency,
  currentUserId,
  myNickname,
  myParticipatesInFinances,
  hasFinancialPartner,
}: {
  expense: ExpenseResponse;
  isExpanded: boolean;
  isConfirmingDelete: boolean;
  onToggle: () => void;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onEdit: () => void;
  onClaim: () => Promise<void>;
  onResolve: () => Promise<void>;
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
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isCreator = expense.createdByUserId === currentUserId;
  const isUnpaid = !expense.paidByUserId;
  const isMyExpense = expense.paidByUserId === currentUserId;
  const canClaim = isUnpaid && myParticipatesInFinances;
  const canMarkPaid =
    financeMode === 'split' &&
    myParticipatesInFinances &&
    hasFinancialPartner &&
    expense.paidByUserId &&
    !isMyExpense &&
    !expense.isResolved;
  const canEdit = isCreator && !expense.isResolved;
  const canDelete = isCreator && !expense.isResolved;

  async function handleAction(action: () => Promise<void>, key: string) {
    setActionLoading(key);
    try { await action(); } finally { setActionLoading(null); }
  }

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', isExpanded && 'ring-1 ring-primary/20')}>
      {/* Summary row — clickable */}
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors',
          'hover:bg-muted/40',
          isExpanded && 'bg-muted/40'
        )}
      >
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CATEGORY_CHIP_CLASSES[expense.category] ?? ''}`}>
          {expense.category}
        </span>
        {expense.recurringExpenseId && (
          <RefreshCw className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Recurring" />
        )}
        <span className="flex-1 truncate text-sm font-medium">{expense.description}</span>
        {expense.paidByNickname ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {expense.paidByNickname}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Unpaid
          </span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
        </span>
        <span className="shrink-0 text-sm font-semibold">{fmt(expense.amount)} {currency}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
      </button>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
          {/* Details grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <span className="text-muted-foreground">Paid by</span>
            <span>{expense.paidByNickname ?? 'Not yet claimed'}</span>
            {expense.notes && (
              <>
                <span className="text-muted-foreground">Notes</span>
                <span className="text-sm">{expense.notes}</span>
              </>
            )}
            {expense.isFullRepayment && (
              <>
                <span className="text-muted-foreground">Split</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 w-fit">Full repayment</span>
              </>
            )}
            {financeMode === 'split' && myParticipatesInFinances && expense.paidByUserId && (
              <>
                <span className="text-muted-foreground">Your share</span>
                <span>{getMyShareLabel(expense, splitMethod, customMyPct, incomeSplit, currency, myNickname)}</span>
              </>
            )}
          </div>

          {/* Status hints */}
          {expense.isResolved && (
            <p className="text-xs text-green-600 dark:text-green-400">✓ Share settled</p>
          )}
          {isUnpaid && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No payer assigned yet. Claim this expense if you paid for it.
            </p>
          )}

          {/* Action buttons — labelled, not icon-only */}
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
              {canMarkPaid && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading === 'resolve'}
                  onClick={() => void handleAction(onResolve, 'resolve')}
                >
                  {actionLoading === 'resolve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark as paid'}
                </Button>
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
              <span className="text-sm text-muted-foreground">Delete this expense?</span>
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
}

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
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      {splitMethod === 'equal' && (
        <p className="text-muted-foreground">Expenses are split <strong>50/50</strong> equally between both partners.</p>
      )}
      {splitMethod === 'income_based' && incomeSplit && (
        <div className="space-y-1.5">
          <p className="font-medium">Income-based split</p>
          <div className="grid grid-cols-2 gap-x-6 text-muted-foreground text-xs">
            <span>{myNickname} — <strong className="text-foreground">{incomeSplit.myPct}%</strong></span>
            <span>{partnerNickname} — <strong className="text-foreground">{incomeSplit.partnerPct}%</strong></span>
          </div>
        </div>
      )}
      {splitMethod === 'income_based' && !incomeSplit && (
        <p className="text-muted-foreground">Income data is incomplete — enter income on the Overview page to see the split.</p>
      )}
      {splitMethod === 'custom' && (
        <div className="space-y-2">
          <p className="font-medium">Custom split</p>
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <span className="w-20 text-right text-xs text-muted-foreground">{myNickname} {customMyPct}%</span>
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
              <span className="w-20 text-xs text-muted-foreground">{partnerNickname} {100 - customMyPct}%</span>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">{myNickname} {customMyPct}% · {partnerNickname} {100 - customMyPct}% (admin only)</p>
          )}
        </div>
      )}
    </div>
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
      <div className="flex justify-center py-4 mt-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (recurringExpenses.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">No active recurring templates.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {recurringExpenses.map((t) => (
        <div key={t._id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CATEGORY_CHIP_CLASSES[t.category] ?? ''}`}>
            {t.category}
          </span>
          <span className="flex-1 truncate text-sm">{t.description}</span>
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground capitalize">
            {t.interval}
          </span>
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {t.payerMode === 'fixed' ? (t.fixedPayerNickname ?? 'Fixed') : 'Open'}
          </span>
          <span className="shrink-0 text-sm font-semibold">{fmt(t.amount)} {currency}</span>
          {(t.createdByUserId === currentUserId || isAdmin) && (
            <button
              onClick={() => void onDeactivate(t._id)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              title="Deactivate"
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
