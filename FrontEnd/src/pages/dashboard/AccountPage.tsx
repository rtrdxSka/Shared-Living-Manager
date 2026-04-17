import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Settings2,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useJointAccountSummary } from '@/hooks/queries';
import JointAccountConfigDialog from '@/components/dashboard/shared/JointAccountConfigDialog';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { fmt, stepMonth, formatMonthLabel, currentMonthString } from '@/utils/dashboardHelpers';
import type { JointAccountTransactionResponse } from '@/types/joint-account.types';

// ── Stats bar ────────────────────────────────────────────────────────────

interface StatsBarProps {
  balance: number;
  monthlyDeposits: number;
  monthlyWithdrawals: number;
  monthlyExpenses: number;
  currency: string;
}

function StatsBar({
  balance,
  monthlyDeposits,
  monthlyWithdrawals,
  monthlyExpenses,
  currency,
}: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Total balance</p>
        <p className={cn('text-2xl font-bold tracking-tight mt-0.5', balance < 0 && 'text-destructive')}>
          {fmt(balance)}
        </p>
        <p className="text-[10px] text-muted-foreground">{currency}</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Deposits this month</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5 text-green-600 dark:text-green-400">
          +{fmt(monthlyDeposits)}
        </p>
        <p className="text-[10px] text-muted-foreground">{currency}</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Withdrawals</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5 text-amber-600 dark:text-amber-400">
          -{fmt(monthlyWithdrawals)}
        </p>
        <p className="text-[10px] text-muted-foreground">{currency}</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Expenses paid</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5 text-destructive">
          -{fmt(monthlyExpenses)}
        </p>
        <p className="text-[10px] text-muted-foreground">{currency}</p>
      </Card>
    </div>
  );
}

// ── Monthly target progress ───────────────────────────────────────────────

function TargetProgress({
  monthlyDeposits,
  monthlyTarget,
  currency,
  memberBreakdown,
}: {
  monthlyDeposits: number;
  monthlyTarget: number;
  currency: string;
  memberBreakdown: { nickname: string; deposits: number; targetAmount?: number }[];
}) {
  const pct = Math.min(100, Math.round((monthlyDeposits / monthlyTarget) * 100));
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Monthly target: {fmt(monthlyTarget)} {currency}</span>
        <span className={cn('font-semibold', pct >= 100 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
          {pct}% reached
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full', pct >= 100 ? 'bg-green-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {memberBreakdown.map((m) => m.targetAmount !== undefined && (
        <div key={m.nickname} className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{m.nickname}</span>
          <span>
            {fmt(m.deposits)} / {fmt(m.targetAmount)} {currency}
          </span>
        </div>
      ))}
    </div>
  );
}

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

  const isDeposit = tx.type === 'deposit';

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
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5">
      {/* Type icon */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isDeposit ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
        )}
      >
        {isDeposit ? (
          <ArrowDownLeft className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <ArrowUpRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {tx.memberNickname}
          {tx.note && <span className="ml-1.5 font-normal text-muted-foreground">— {tx.note}</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(tx.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Amount */}
      <span
        className={cn(
          'text-sm font-semibold shrink-0',
          isDeposit ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
        )}
      >
        {isDeposit ? '+' : '-'}{fmt(tx.amount)} {currency}
      </span>

      {/* Delete */}
      {!isConfirming ? (
        <button
          onClick={() => setConfirmingDelete(tx._id)}
          className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete transaction"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M6 4V3a1 1 0 012 0v1m2 0v9a1 1 0 01-1 1H7a1 1 0 01-1-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-1 ml-1">
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

// ── Main page ────────────────────────────────────────────────────────────

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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Joint Account</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Shared balance and monthly transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Target
            </Button>
          )}
          <Button size="sm" onClick={() => setAddTransactionOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : summary ? (
        <StatsBar
          balance={summary.balance}
          monthlyDeposits={summary.monthlyDeposits}
          monthlyWithdrawals={summary.monthlyWithdrawals}
          monthlyExpenses={summary.monthlyExpenses}
          currency={currency}
        />
      ) : null}

      {/* Monthly target progress */}
      {summary?.monthlyTarget && summary.monthlyTarget > 0 && (
        <TargetProgress
          monthlyDeposits={summary.monthlyDeposits}
          monthlyTarget={summary.monthlyTarget}
          currency={currency}
          memberBreakdown={memberBreakdown}
        />
      )}

      {/* Member contribution breakdown */}
      {memberBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Member Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {memberBreakdown.map((m) => (
              <div
                key={m.memberId}
                className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
              >
                <span className="text-sm font-medium">{m.nickname}</span>
                <div className="text-right text-xs">
                  <p className="text-green-600 dark:text-green-400">
                    +{fmt(m.deposits)} deposits
                  </p>
                  {m.withdrawals > 0 && (
                    <p className="text-amber-600 dark:text-amber-400">
                      -{fmt(m.withdrawals)} withdrawals
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAccountMonth((m) => stepMonth(m, 'prev'))}
                className="rounded p-1 hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <CardTitle className="text-base font-semibold">
                {formatMonthLabel(accountMonth)}
              </CardTitle>
              <button
                onClick={() => setAccountMonth((m) => stepMonth(m, 'next'))}
                className="rounded p-1 hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No transactions this month"
              description="Add a deposit or withdrawal to track your joint account activity."
              action={{ label: 'Add transaction', onClick: () => setAddTransactionOpen(true) }}
            />
          ) : (
            <div className="space-y-2">
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
        </CardContent>
      </Card>

      {/* Config dialog — rendered locally to access summary data for pre-fill */}
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
