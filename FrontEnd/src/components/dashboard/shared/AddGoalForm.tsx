import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddGoal } from '@/hooks/queries';
import { GOAL_CATEGORIES } from '@/types/goal.types';

interface AddGoalFormProps {
  householdId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currency: string;
}

export default function AddGoalForm({
  householdId,
  open,
  onOpenChange,
  currency,
}: AddGoalFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addGoalMutation = useAddGoal(householdId);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setName('');
      setDescription('');
      setTargetAmount('');
      setDeadline('');
      setCategory('');
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addGoalMutation.mutateAsync({
        name: name.trim(),
        targetAmount: parseFloat(targetAmount),
        ...(description.trim() && { description: description.trim() }),
        ...(deadline && { deadline: new Date(deadline).toISOString() }),
        ...(category && category !== '__none__' && { category: category as 'savings' | 'travel' | 'home' | 'emergency' | 'other' }),
      });
      onOpenChange(false);
    } catch {
      setError('Failed to add goal. Please try again.');
    }
  }

  const canSubmit = name.trim().length > 0 && parseFloat(targetAmount) > 0 && !addGoalMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Add Goal</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              NAME
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Summer Vacation"
              required
              disabled={addGoalMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              TARGET AMOUNT ({currency})
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="e.g. 3000"
              required
              disabled={addGoalMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              DESCRIPTION <span className="normal-case tracking-normal font-sans text-ink-3">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Any details..."
              disabled={addGoalMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              DEADLINE <span className="normal-case tracking-normal font-sans text-ink-3">(optional)</span>
            </label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={addGoalMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              CATEGORY <span className="normal-case tracking-normal font-sans text-ink-3">(optional)</span>
            </label>
            <Select
              value={category || '__none__'}
              onValueChange={(v) => setCategory(v === '__none__' ? '' : v)}
              disabled={addGoalMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {GOAL_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-xs text-neg mt-1">{error}</p>}

          <Button type="submit" disabled={!canSubmit} className="mt-2">
            {addGoalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Goal'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
