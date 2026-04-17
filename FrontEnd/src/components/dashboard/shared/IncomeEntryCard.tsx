import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { extractApiError } from '@/utils/extractApiError';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateIncome } from '@/hooks/queries';
import type { HouseholdResponse } from '@/types/household.types';

interface IncomeEntryCardProps {
  household: HouseholdResponse;
  currentUserId: string;
}

export default function IncomeEntryCard({ household, currentUserId }: IncomeEntryCardProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateIncomeMutation = useUpdateIncome(household._id);

  const currency = household.settings.currency;

  const myMember = household.members.find((m) => m.userId === currentUserId);
  const waitingMembers = household.members.filter(
    (m) => m.participatesInFinances && m.userId && m.userId !== currentUserId && m.monthlyIncome === undefined
  );

  const myIncomeSet = myMember?.monthlyIncome !== undefined;

  const handleSave = async () => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid non-negative number.');
      return;
    }

    setError(null);
    try {
      await updateIncomeMutation.mutateAsync(parsed);
    } catch (error) {
      setError(extractApiError(error, 'Failed to save income. Please try again.'));
    }
  };

  // Nothing to show if both income is set and no waiting members
  if (myIncomeSet && waitingMembers.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30">
      <CardContent className="space-y-3 px-4 py-4">
        {!myIncomeSet && (
          <>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Income data needed</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This household uses income-based splitting. Enter your monthly income to see your share.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-800 dark:text-amber-300">Monthly income:</span>
              <Input
                type="number"
                min={0}
                step={1}
                max={1000000}
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 w-36 bg-white dark:bg-amber-950/60"
                disabled={updateIncomeMutation.isPending}
              />
              <span className="text-sm text-amber-800 dark:text-amber-300">{currency}</span>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateIncomeMutation.isPending || value === ''}
                className="h-8"
              >
                {updateIncomeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </Button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        )}

        {waitingMembers.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Waiting for:{' '}
            {waitingMembers.map((m) => m.nickname).join(', ')} to enter their income
          </p>
        )}
      </CardContent>
    </Card>
  );
}
