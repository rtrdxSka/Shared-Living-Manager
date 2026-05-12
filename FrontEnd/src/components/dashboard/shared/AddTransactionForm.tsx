import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { extractApiError } from '@/utils/extractApiError';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddJointTransaction } from '@/hooks/queries';
import { fmt } from '@/utils/dashboardHelpers';
import type { TransactionType } from '@/types/joint-account.types';

interface AddTransactionFormProps {
  householdId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currency: string;
  /** Current joint-account balance — used to intercept withdrawals that would overdraw. */
  currentBalance?: number;
  /** Which mode the form opens in. Defaults to 'deposit'. */
  defaultType?: TransactionType;
}

interface PendingPayload {
  type: TransactionType;
  amount: number;
  note?: string;
}

export default function AddTransactionForm({
  householdId,
  open,
  onOpenChange,
  currency,
  currentBalance,
  defaultType,
}: AddTransactionFormProps) {
  const [type, setType] = useState<TransactionType>(defaultType ?? 'deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [overdrawConfirmOpen, setOverdrawConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<PendingPayload | null>(null);

  const addMutation = useAddJointTransaction(householdId);

  useEffect(() => {
    if (open) {
      setType(defaultType ?? 'deposit');
    } else {
      setType(defaultType ?? 'deposit');
      setAmount('');
      setNote('');
      setError(null);
      setOverdrawConfirmOpen(false);
      setPendingPayload(null);
    }
  }, [open, defaultType]);

  async function runMutation(payload: PendingPayload) {
    setError(null);
    try {
      await addMutation.mutateAsync(payload);
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, 'Failed to add transaction. Please try again.'));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseFloat(amount);
    if (!(parsed > 0)) return;
    const payload: PendingPayload = {
      type,
      amount: parsed,
      ...(note.trim() && { note: note.trim() }),
    };

    // Intercept withdrawals that exceed the current balance.
    if (
      type === 'withdrawal' &&
      typeof currentBalance === 'number' &&
      parsed > currentBalance
    ) {
      setPendingPayload(payload);
      setOverdrawConfirmOpen(true);
      return;
    }

    await runMutation(payload);
  }

  async function handleConfirmOverdraw() {
    if (!pendingPayload) {
      setOverdrawConfirmOpen(false);
      return;
    }
    const payload = pendingPayload;
    setOverdrawConfirmOpen(false);
    setPendingPayload(null);
    await runMutation(payload);
  }

  function handleCancelOverdraw() {
    setOverdrawConfirmOpen(false);
    setPendingPayload(null);
  }

  const canSubmit = parseFloat(amount) > 0 && !addMutation.isPending;

  const overdrawAmount =
    pendingPayload && typeof currentBalance === 'number'
      ? pendingPayload.amount - currentBalance
      : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Add Transaction</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              TYPE
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('deposit')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  type === 'deposit'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line bg-surface-2 text-ink-3 hover:border-line-2 hover:bg-surface-2 hover:text-ink'
                }`}
                disabled={addMutation.isPending}
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => setType('withdrawal')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  type === 'withdrawal'
                    ? 'border-warn/60 bg-warn-bg text-warn'
                    : 'border-line bg-surface-2 text-ink-3 hover:border-line-2 hover:bg-surface-2 hover:text-ink'
                }`}
                disabled={addMutation.isPending}
              >
                Withdrawal
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              AMOUNT ({currency})
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="1000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              required
              disabled={addMutation.isPending}
            />
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              NOTE <span className="normal-case tracking-normal font-sans text-ink-3">(optional)</span>
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. Monthly contribution"
              disabled={addMutation.isPending}
            />
          </div>

          {error && <p className="text-xs text-neg mt-1">{error}</p>}

          <Button type="submit" disabled={!canSubmit} className="mt-2">
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : type === 'deposit' ? (
              'Add Deposit'
            ) : (
              'Add Withdrawal'
            )}
          </Button>
        </form>

        {/* Overdraw confirm dialog — keeps the form open behind it. */}
        {overdrawConfirmOpen && pendingPayload && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="overdraw-confirm-title"
            aria-describedby="overdraw-confirm-description"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
              <h2 id="overdraw-confirm-title" className="text-lg font-semibold">
                Overdraw account?
              </h2>
              <p id="overdraw-confirm-description" className="mt-1 text-sm text-ink-2">
                This will overdraw the account by {fmt(overdrawAmount)} {currency}. Continue?
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelOverdraw}
                  disabled={addMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleConfirmOverdraw()}
                  disabled={addMutation.isPending}
                  autoFocus
                >
                  {addMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
