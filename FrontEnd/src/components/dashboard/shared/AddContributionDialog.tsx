import { useContext, useMemo, useState } from 'react';
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
import { DashboardContext } from '@/contexts/useDashboard';
import {
  crossedMilestone,
  requiredMonthlyContribution,
  splitContribution,
  type Milestone,
} from '@/utils/goalPlanner';
import { fmt } from '@/utils/dashboardHelpers';
import GoalMilestoneCelebration from '@/components/dashboard/couple/GoalMilestoneCelebration';

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
  const [celebration, setCelebration] = useState<{ milestone: Milestone; goalName: string } | null>(null);

  const addContributionMutation = useAddContribution(householdId);

  // Read dashboard context directly (not via the throwing hook) so the dialog
  // still works if rendered without a provider — the couple extras are additive.
  const dashboard = useContext(DashboardContext);
  const isCouple = dashboard?.uiMode === 'couple';
  const contributionTarget = dashboard?.contributionTarget ?? null;
  const splitMethod = dashboard?.splitMethod ?? 'equal';
  const incomeSplit = dashboard?.incomeSplit ?? null;
  const customMyPct = dashboard?.customMyPct ?? 50;

  // Couple mode: suggest this user's proportional share of the goal's required
  // monthly contribution (only for goals with a deadline that aren't funded yet).
  const suggestedMine = useMemo(() => {
    if (!isCouple || !contributionTarget) return null;
    const remaining = Math.max(0, contributionTarget.targetAmount - contributionTarget.currentAmount);
    const required = requiredMonthlyContribution(remaining, contributionTarget.deadline, new Date());
    if (required === null || required <= 0) return null;
    return splitContribution(required, { splitMethod, incomeSplit, customMyPct }).mine;
  }, [isCouple, contributionTarget, splitMethod, incomeSplit, customMyPct]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setAmount('');
      setNote('');
      setError(null);
    } else {
      // Opening: pre-fill the suggested share when we have one.
      setAmount(suggestedMine !== null ? String(suggestedMine) : '');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    try {
      await addContributionMutation.mutateAsync({
        goalId,
        input: {
          amount: amt,
          ...(note.trim() && { note: note.trim() }),
        },
      });
      // Couple mode: celebrate if this contribution crossed a milestone.
      if (isCouple && contributionTarget && contributionTarget.targetAmount > 0) {
        const { targetAmount, currentAmount } = contributionTarget;
        const milestone = crossedMilestone(
          (currentAmount / targetAmount) * 100,
          ((currentAmount + amt) / targetAmount) * 100
        );
        if (milestone) setCelebration({ milestone, goalName });
      }
      onOpenChange(false);
    } catch {
      setError('Failed to add contribution. Please try again.');
    }
  }

  const canSubmit = parseFloat(amount) > 0 && !addContributionMutation.isPending;

  return (
    <>
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
            {suggestedMine !== null && (
              <p className="text-xs text-ink-3" data-testid="contribution-suggestion">
                Suggested: your {fmt(suggestedMine)} {currency} share this month.
              </p>
            )}
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
    <GoalMilestoneCelebration
      milestone={celebration?.milestone ?? null}
      goalName={celebration?.goalName ?? ''}
      onDone={() => setCelebration(null)}
    />
    </>
  );
}
