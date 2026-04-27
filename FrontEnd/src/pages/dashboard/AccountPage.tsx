import { useState } from 'react';
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
import { useDashboard } from '@/contexts/DashboardContext';
import { useJointAccountSummary } from '@/hooks/queries';
import JointAccountConfigDialog from '@/components/dashboard/shared/JointAccountConfigDialog';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { HeroNumberCard } from '@/components/ui/hero-number-card';
import { MoneyAmount } from '@/components/ui/money-amount';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { fmt, stepMonth, formatMonthLabel, currentMonthString } from '@/utils/dashboardHelpers';
import type { JointAccountTransactionResponse } from '@/types/joint-account.types';

// ── Transaction row ───────────────────────────────────────────────────────

interface TransactionRowProps {
  tx: JointAccountTransactionResponse;
  currency: string;
  confirmingDelete: string | null;
  setConfirmingDelete: (id: string | null) => void;
  onDelete: (id: string) => Promise<void>;
}

function TransactionRow({
  tx,
  currency,
  confirmingDelete,
  setConfirmingDelete,
  onDelete,
}: TransactionRowProps) {
  const [deletePending, setDeletePending] = useState(false);
  const isConfirming = confirmingDelete === tx._id;
  const isInbound = tx.type === 'deposit';

  async function handleDelete() {
    setDeletePending(true);
    try {
      await onDelete(tx._id);
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
        <p className="text-sm text-ink truncate">
          {tx.memberNickname}
          {tx.note && (
            <span className="ml-1.5 text-ink-3"> — {tx.note}</span>
          )}
        </p>
        <p className="text-[11px] font-mono text-ink-3">
          {new Date(tx.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Amount */}
      <MoneyAmount
        amount={isInbound ? tx.amount : -tx.amount}
        currency={currency}
        signed
        tone={isInbound ? 'pos' : 'neutral'}
        size="sm"
        className="shrink-0"
      />

      {/* Delete */}
      {!isConfirming ? (
        <button
          onClick={() => setConfirmingDelete(tx._id)}
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
      )}
    </div>
  );
}

// ── Contribution bar colour map (primary vs other) ────────────────────────

const CONTRIB_BAR: [string, string] = ['bg-accent', 'bg-cat-rent'];

// ── Main page ─────────────────────────────────────────────────────────────

export default function AccountPage() {
  const {
    household,
    currency,
    isAdmin,
    setAddTransactionOpen,
    deleteJointTransaction,
  } = useDashboard();

  const [accountMonth, setAccountMonth] = useState(currentMonthString);
  const [configOpen, setConfigOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const { data: summary, isLoading } = useJointAccountSummary(
    household._id,
    accountMonth,
    true
  );

  const transactions = summary?.transactions ?? [];
  const memberBreakdown = summary?.memberBreakdown ?? [];

  // Monthly target progress
  const hasTarget = !!summary?.monthlyTarget && summary.monthlyTarget > 0;
  const pct = hasTarget
    ? Math.min(100, Math.round(((summary?.monthlyDeposits ?? 0) / (summary?.monthlyTarget ?? 1)) * 100))
    : 0;

  // Total deposits for contributions percentage
  const totalDeposits = memberBreakdown.reduce((s, m) => s + m.deposits, 0);

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
                {hasTarget && (
                  <div className="w-full max-w-[480px] h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setAddTransactionOpen(true)}>
                  Deposit
                </Button>
                <Button variant="outline" onClick={() => setAddTransactionOpen(true)}>
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
              ) : transactions.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No transactions this month"
                  description="Add a deposit or withdrawal to track your joint account activity."
                  action={{ label: 'Add transaction', onClick: () => setAddTransactionOpen(true) }}
                />
              ) : (
                <div>
                  {transactions.map((tx) => (
                    <TransactionRow
                      key={tx._id}
                      tx={tx}
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
            {/* Contributions this month */}
            {memberBreakdown.length > 0 && (
              <Card className="p-5 space-y-4">
                <EyebrowLabel as="div">CONTRIBUTIONS THIS MONTH</EyebrowLabel>
                <div className="space-y-3">
                  {memberBreakdown.map((m, i) => {
                    const memberPct =
                      totalDeposits > 0
                        ? Math.round((m.deposits / totalDeposits) * 100)
                        : 0;
                    const barClass = CONTRIB_BAR[i % CONTRIB_BAR.length];
                    return (
                      <div key={m.memberId} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={m.nickname} size={28} />
                            <span className="text-sm text-ink truncate">{m.nickname}</span>
                          </div>
                          <span className="text-xs text-ink-3 font-mono shrink-0">
                            {memberPct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', barClass)}
                            style={{ width: `${memberPct}%` }}
                          />
                        </div>
                        <p className="text-[11px] font-mono text-ink-3">
                          {fmt(m.deposits)} {currency} deposited
                          {m.withdrawals > 0 && ` · ${fmt(m.withdrawals)} withdrawn`}
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
      <JointAccountConfigDialog
        householdId={household._id}
        open={configOpen}
        onOpenChange={setConfigOpen}
        currency={currency}
        currentTarget={summary?.monthlyTarget}
        currentMode={summary?.targetMode}
      />
    </div>
  );
}
