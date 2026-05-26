import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useDashboard } from '@/contexts/useDashboard';
import { useJointAccountSummary } from '@/hooks/queries';
import JointAccountConfigDialog from '@/components/dashboard/shared/JointAccountConfigDialog';
import IncomeManagementCard from '@/components/dashboard/shared/IncomeManagementCard';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { HeroNumberCard } from '@/components/ui/hero-number-card';
import { MoneyAmount } from '@/components/ui/money-amount';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { CategoryChip, type Category } from '@/components/ui/category-chip';
import { fmt, stepMonth, formatMonthLabel, currentMonthString } from '@/utils/dashboardHelpers';
import type { ActivityItemResponse } from '@/types/joint-account.types';

// ── Activity row ──────────────────────────────────────────────────────────
// Renders one item of the unified feed: a joint-account transaction
// (deposit/withdrawal, deletable) or an expense (outflow, read-only — expenses
// are managed on the Expenses tab).

interface ActivityRowProps {
  item: ActivityItemResponse;
  currency: string;
  confirmingDelete: string | null;
  setConfirmingDelete: (id: string | null) => void;
  onDelete: (id: string) => Promise<void>;
}

function ActivityRow({
  item,
  currency,
  confirmingDelete,
  setConfirmingDelete,
  onDelete,
}: ActivityRowProps) {
  const [deletePending, setDeletePending] = useState(false);
  const isConfirming = confirmingDelete === item._id;
  const isInbound = item.type === 'deposit';
  const isExpense = item.kind === 'expense';
  const canDelete = item.kind === 'transaction';

  async function handleDelete() {
    setDeletePending(true);
    try {
      await onDelete(item._id);
    } finally {
      setDeletePending(false);
      setConfirmingDelete(null);
    }
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-b-0">
      {/* Direction icon */}
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
          isInbound ? 'bg-pos/15 text-pos' : 'bg-neg/10 text-ink-2'
        )}
      >
        {isInbound ? (
          <ArrowDownLeft className="h-4 w-4" />
        ) : (
          <ArrowUpRight className="h-4 w-4" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate flex items-center gap-1.5">
          {isExpense && item.category && (
            <CategoryChip category={item.category as Category} className="shrink-0" />
          )}
          <span className="truncate">
            {item.memberNickname}
            {item.note && (
              <span className="ml-1.5 text-ink-3"> — {item.note}</span>
            )}
          </span>
        </p>
        <p className="text-[11px] font-mono text-ink-3">
          {new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          {isExpense && <span className="ml-1.5 text-ink-4">· expense</span>}
        </p>
      </div>

      {/* Amount */}
      <MoneyAmount
        amount={isInbound ? item.amount : -item.amount}
        currency={currency}
        signed
        tone={isInbound ? 'pos' : 'neutral'}
        size="sm"
        className="shrink-0"
      />

      {/* Delete — transactions only; expenses are managed on the Expenses tab */}
      {canDelete &&
        (!isConfirming ? (
          <button
            onClick={() => setConfirmingDelete(item._id)}
            className="ml-1 text-ink-3 hover:text-neg transition-colors shrink-0"
            title="Delete transaction"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 4h10M6 4V3a1 1 0 012 0v1m2 0v9a1 1 0 01-1 1H7a1 1 0 01-1-1V4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-1 ml-1 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={handleDelete}
              disabled={deletePending}
            >
              {deletePending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setConfirmingDelete(null)}
              disabled={deletePending}
            >
              Cancel
            </Button>
          </div>
        ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AccountPage() {
  const {
    household,
    currentUserId,
    uiMode,
    currency,
    isAdmin,
    financeMode,
    setAddTransactionOpen,
    openTransactionForm,
    deleteJointTransaction,
  } = useDashboard();

  const [accountMonth, setAccountMonth] = useState(currentMonthString);
  const [configOpen, setConfigOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Redirect direct-URL access in split mode — Account tab does not exist there.
  const isSplitMode = financeMode === 'split';

  const { data: summary, isLoading } = useJointAccountSummary(
    household._id,
    accountMonth,
    !isSplitMode
  );

  if (uiMode === 'couple' && isSplitMode) {
    return <Navigate to="/dashboard/expenses" replace />;
  }

  // Solo users have no joint account — show a clean Account view with just income management.
  if (uiMode === 'solo') {
    return (
      <div className="pb-8">
        <DashboardHeader
          title="Account"
          subtitle={`${household.name} · Your monthly income`}
        />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <IncomeManagementCard
            household={household}
            currentUserId={currentUserId}
            currency={currency}
          />
        </div>
      </div>
    );
  }

  const activity = summary?.activity ?? [];
  const memberBreakdown = summary?.memberBreakdown ?? [];

  // Monthly target progress
  const hasTarget = !!summary?.monthlyTarget && summary.monthlyTarget > 0;
  const pct = hasTarget
    ? Math.min(100, Math.round(((summary?.monthlyDeposits ?? 0) / (summary?.monthlyTarget ?? 1)) * 100))
    : 0;

  // Total deposits for contributions percentage
  const totalDeposits = memberBreakdown.reduce((s, m) => s + m.deposits, 0);

  const financialMembers = household.members.filter((m) => m.participatesInFinances);
  const totalIncome = financialMembers.reduce((s, m) => s + (m.monthlyIncome ?? 0), 0);
  const isProportional = summary?.targetMode === 'proportional';
  const showIncomeCard = isProportional;
  const showIncomeChips = isProportional && totalIncome > 0;

  // Income-based targets need every participating member's income. When any is
  // unset, the backend falls back to an equal split — surface that here.
  const missingIncomeMembers = financialMembers.filter(
    (m) => typeof m.monthlyIncome !== 'number'
  );
  const incomeComplete = missingIncomeMembers.length === 0;
  const missingIncomeNicknames = missingIncomeMembers.map((m) => m.nickname);
  // Proportional mode that effectively splits equally (incomplete data or all-zero income).
  const proportionalSplitsEqually = isProportional && (!incomeComplete || totalIncome === 0);
  const showIncomeFallbackBanner =
    !!summary && hasTarget && isProportional && !incomeComplete;

  return (
    <div className="pb-8">
      <DashboardHeader
        title="Joint Account"
        subtitle={`${household.name} · Shared balance & monthly transactions`}
        rightSlot={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                Adjust target
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Overdraft warning rail ── */}
        {summary && summary.balance < 0 && (
          <div
            role="alert"
            className="rounded-md border border-neg/40 bg-neg/[0.08] px-4 py-2 text-sm text-neg"
          >
            Joint account is overdrawn by {fmt(Math.abs(summary.balance))} {currency}.
          </div>
        )}

        {/* ── Income-based fallback rail ── */}
        {showIncomeFallbackBanner && (
          <div
            role="status"
            className="rounded-md border border-accent/40 bg-accent/[0.08] px-4 py-2 text-sm text-ink-2"
          >
            Income-based targets need everyone's income — still waiting on{' '}
            <span className="text-ink">{missingIncomeNicknames.join(' and ')}</span>.
            Contributions are split equally for now.
          </div>
        )}

        {/* ── Hero balance card ── */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-ink-3" />
          </div>
        ) : summary ? (
          <HeroNumberCard
            eyebrow={<EyebrowLabel as="span">CURRENT BALANCE</EyebrowLabel>}
            hero={
              <MoneyAmount
                amount={summary.balance}
                currency={currency}
                size="hero"
                tone="auto"
              />
            }
            subline={
              <div className="space-y-3">
                <p className="text-sm text-ink-2">
                  {hasTarget
                    ? `You've deposited ${fmt(summary.monthlyDeposits)} ${currency} of ${fmt(summary.monthlyTarget!)} ${currency} monthly target`
                    : `${fmt(summary.monthlyDeposits)} ${currency} deposited this month`}
                </p>
                {summary.monthlyExpenses > 0 && (
                  <p className="text-sm text-ink-3">
                    {fmt(summary.monthlyExpenses)} {currency} spent this month
                    <span className="text-ink-4">
                      {' · '}net {fmt(summary.monthlyNet)} {currency}
                    </span>
                  </p>
                )}
                {hasTarget ? (
                  <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : isAdmin ? (
                  <div className="space-y-2">
                    <div
                      className="h-2 w-full rounded-full border border-dashed border-ink-3/40"
                      aria-hidden
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfigOpen(true)}
                    >
                      Set a monthly target
                    </Button>
                  </div>
                ) : null}
                {hasTarget && summary.targetMode && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                      summary.targetMode === 'proportional'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-surface-2 text-ink-3'
                    )}
                  >
                    {summary.targetMode === 'proportional'
                      ? proportionalSplitsEqually
                        ? 'Mode: Income-based · split equally for now'
                        : 'Mode: Income-based'
                      : 'Mode: Equal'}
                  </span>
                )}
              </div>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => openTransactionForm('deposit')}>
                  Deposit
                </Button>
                <Button variant="outline" onClick={() => openTransactionForm('withdrawal')}>
                  Withdraw
                </Button>
                {isAdmin && (
                  <Button variant="ghost" onClick={() => setConfigOpen(true)}>
                    Adjust target
                  </Button>
                )}
              </div>
            }
          />
        ) : null}

        {/* ── Main content grid ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Recent activity */}
          <div className="space-y-4">
            {/* Month navigator */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAccountMonth((m) => stepMonth(m, 'prev'))}
                className="rounded p-1 hover:bg-surface-2 text-ink-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-ink min-w-[120px] text-center">
                {formatMonthLabel(accountMonth)}
              </span>
              <button
                onClick={() => setAccountMonth((m) => stepMonth(m, 'next'))}
                className="rounded p-1 hover:bg-surface-2 text-ink-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <EyebrowLabel as="div">RECENT ACTIVITY</EyebrowLabel>

            <Card className="p-5">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-ink-3" />
                </div>
              ) : activity.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No activity this month"
                  description="Deposits, withdrawals, and expenses will show up here."
                  action={{ label: 'Add transaction', onClick: () => setAddTransactionOpen(true) }}
                />
              ) : (
                <div>
                  {activity.map((item) => (
                    <ActivityRow
                      key={item._id}
                      item={item}
                      currency={currency}
                      confirmingDelete={confirmingDelete}
                      setConfirmingDelete={setConfirmingDelete}
                      onDelete={deleteJointTransaction}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            {(uiMode === 'couple' || uiMode === 'roommates') && showIncomeCard && (
              <IncomeManagementCard
                household={household}
                currentUserId={currentUserId}
                currency={currency}
              />
            )}
            {/* Contributions this month */}
            {memberBreakdown.length > 0 && (
              <Card className="p-5 space-y-4">
                <EyebrowLabel as="div">CONTRIBUTIONS THIS MONTH</EyebrowLabel>
                <div className="space-y-3">
                  {memberBreakdown.map((m) => {
                    const member = financialMembers.find(
                      (fm) => fm._id === m.memberId
                    );
                    const showIncomePct =
                      showIncomeChips && member?.monthlyIncome !== undefined;
                    const incomePct = showIncomePct
                      ? Math.round(((member!.monthlyIncome ?? 0) / totalIncome) * 100)
                      : null;
                    const hasTargetAmount =
                      typeof m.targetAmount === 'number' && m.targetAmount > 0;
                    const memberPct = hasTargetAmount
                      ? Math.round((m.deposits / (m.targetAmount as number)) * 100)
                      : totalDeposits > 0
                        ? Math.round((m.deposits / totalDeposits) * 100)
                        : 0;
                    const barWidthPct = hasTargetAmount
                      ? Math.min(100, (m.deposits / (m.targetAmount as number)) * 100)
                      : memberPct;
                    return (
                      <div key={m.memberId} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={m.nickname} size={28} />
                            <span className="text-sm text-ink truncate">{m.nickname}</span>
                            {showIncomePct && (
                              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-accent bg-accent/10 rounded-full px-1.5 py-0.5 shrink-0">
                                {incomePct}%
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-ink-3 font-mono shrink-0">
                            {memberPct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            data-testid="contrib-bar"
                            className="h-full rounded-full transition-all bg-accent"
                            style={{ width: `${barWidthPct}%` }}
                          />
                        </div>
                        <p className="text-[11px] font-mono text-ink-3">
                          {hasTargetAmount
                            ? `${fmt(m.deposits)} of ${fmt(m.targetAmount as number)} ${currency} target`
                            : `${fmt(m.deposits)} ${currency} deposited${m.withdrawals > 0 ? ` · ${fmt(m.withdrawals)} withdrawn` : ''}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Auto-deposit nudge */}
            <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-5 flex items-start gap-4">
              <Sparkles className="h-5 w-5 text-accent mt-0.5 shrink-0" />
              <div className="flex flex-col gap-2">
                <EyebrowLabel as="span">AUTO-DEPOSIT ON?</EyebrowLabel>
                <p className="text-sm text-ink-2">
                  Schedule a recurring transfer so you never miss the target.
                </p>
                <Button variant="ghost" size="sm" disabled className="self-start px-0 text-accent hover:text-accent">
                  Set up
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Config dialog */}
      {(uiMode === 'couple' || uiMode === 'roommates') && (
        <JointAccountConfigDialog
          householdId={household._id}
          open={configOpen}
          onOpenChange={setConfigOpen}
          currency={currency}
          currentTarget={summary?.monthlyTarget}
          currentMode={summary?.targetMode}
          membersMissingIncome={missingIncomeNicknames}
        />
      )}
    </div>
  );
}
