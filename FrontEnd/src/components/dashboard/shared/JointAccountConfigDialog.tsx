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
import { useUpdateJointAccountConfig } from '@/hooks/queries';
import type { ContributionTargetMode } from '@/types/joint-account.types';

interface JointAccountConfigDialogProps {
  householdId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currency: string;
  currentTarget?: number;
  currentMode?: ContributionTargetMode;
}

export default function JointAccountConfigDialog({
  householdId,
  open,
  onOpenChange,
  currency,
  currentTarget,
  currentMode,
}: JointAccountConfigDialogProps) {
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [targetMode, setTargetMode] = useState<ContributionTargetMode>('equal');
  const [error, setError] = useState<string | null>(null);

  const updateConfigMutation = useUpdateJointAccountConfig(householdId);

  useEffect(() => {
    if (open) {
      setMonthlyTarget(currentTarget?.toString() ?? '');
      setTargetMode(currentMode ?? 'equal');
      setError(null);
    }
  }, [open, currentTarget, currentMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const parsedTarget = parseFloat(monthlyTarget);
      await updateConfigMutation.mutateAsync({
        monthlyTarget: parsedTarget > 0 ? parsedTarget : null,
        targetMode,
      });
      onOpenChange(false);
    } catch (error) {
      setError(extractApiError(error, 'Failed to update configuration. Please try again.'));
    }
  }

  async function handleClearTarget() {
    setError(null);
    try {
      await updateConfigMutation.mutateAsync({ monthlyTarget: null });
      onOpenChange(false);
    } catch (error) {
      setError(extractApiError(error, 'Failed to clear target. Please try again.'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Contribution Target</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Monthly target amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Monthly Target ({currency})
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="1000000"
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(e.target.value)}
              placeholder="e.g. 1000"
              disabled={updateConfigMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Total monthly contribution target for the household
            </p>
          </div>

          {/* Target mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Split Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('equal')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  targetMode === 'equal'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
                disabled={updateConfigMutation.isPending}
              >
                Equal
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('proportional')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  targetMode === 'proportional'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
                disabled={updateConfigMutation.isPending}
              >
                Income-based
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {targetMode === 'equal'
                ? 'Each member contributes the same amount'
                : 'Contributions proportional to monthly income'}
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={updateConfigMutation.isPending}
            className="mt-2"
          >
            {updateConfigMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Save Target'
            )}
          </Button>

          {currentTarget !== undefined && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearTarget}
              disabled={updateConfigMutation.isPending}
            >
              Clear Target
            </Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
