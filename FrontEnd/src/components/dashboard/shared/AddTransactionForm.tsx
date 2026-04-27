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
import type { TransactionType } from '@/types/joint-account.types';

interface AddTransactionFormProps {
  householdId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currency: string;
}

export default function AddTransactionForm({
  householdId,
  open,
  onOpenChange,
  currency,
}: AddTransactionFormProps) {
  const [type, setType] = useState<TransactionType>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addMutation = useAddJointTransaction(householdId);

  useEffect(() => {
    if (!open) {
      setType('deposit');
      setAmount('');
      setNote('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addMutation.mutateAsync({
        type,
        amount: parseFloat(amount),
        ...(note.trim() && { note: note.trim() }),
      });
      onOpenChange(false);
    } catch (error) {
      setError(extractApiError(error, 'Failed to add transaction. Please try again.'));
    }
  }

  const canSubmit = parseFloat(amount) > 0 && !addMutation.isPending;

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
      </SheetContent>
    </Sheet>
  );
}
