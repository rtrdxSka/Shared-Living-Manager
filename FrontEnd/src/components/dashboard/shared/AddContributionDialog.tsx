import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddContribution } from '@/hooks/queries';

interface AddContributionDialogProps {
  householdId: string;
  goalId: string;
  goalName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currency: string;
}

export default function AddContributionDialog({
  householdId,
  goalId,
  goalName,
  open,
  onOpenChange,
  currency,
}: AddContributionDialogProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addContributionMutation = useAddContribution(householdId);

  useEffect(() => {
    if (!open) {
      setAmount('');
      setNote('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addContributionMutation.mutateAsync({
        goalId,
        input: {
          amount: parseFloat(amount),
          ...(note.trim() && { note: note.trim() }),
        },
      });
      onOpenChange(false);
    } catch {
      setError('Failed to add contribution. Please try again.');
    }
  }

  const canSubmit = parseFloat(amount) > 0 && !addContributionMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Contribute to {goalName}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              AMOUNT ({currency})
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 100"
              required
              disabled={addContributionMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              NOTE <span className="normal-case tracking-normal font-sans text-ink-3">(optional)</span>
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. Monthly savings"
              disabled={addContributionMutation.isPending}
            />
          </div>

          {error && <p className="text-xs text-neg mt-1">{error}</p>}

          <Button type="submit" disabled={!canSubmit} className="mt-2">
            {addContributionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Contribution'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
