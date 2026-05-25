import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { extractApiError } from '@/utils/extractApiError';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyAmount } from '@/components/ui/money-amount';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { useUpdateIncome } from '@/hooks/queries';
import type { HouseholdResponse } from '@/types/household.types';

interface IncomeManagementCardProps {
  household: HouseholdResponse;
  currentUserId: string;
  currency: string;
}

export default function IncomeManagementCard({
  household,
  currentUserId,
  currency,
}: IncomeManagementCardProps) {
  const myMember = household.members.find((m) => m.userId === currentUserId);

  const myIncome = myMember?.monthlyIncome;
  const myIncomeSet = myIncome !== undefined;

  const [mode, setMode] = useState<'view' | 'edit'>(myIncomeSet ? 'view' : 'edit');
  const [value, setValue] = useState<string>(myIncomeSet ? String(myIncome) : '');
  const [error, setError] = useState<string | null>(null);

  const updateIncomeMutation = useUpdateIncome(household._id);

  const financialMembers = household.members.filter((m) => m.participatesInFinances);
  const totalIncome = financialMembers.reduce(
    (s, m) => s + (m.monthlyIncome ?? 0),
    0
  );

  // Every OTHER financial member — works for couples (one) and roommates (N).
  const otherMembers = financialMembers.filter(
    (m) => m.userId && m.userId !== currentUserId
  );

  const handleEdit = () => {
    setValue(myIncomeSet ? String(myIncome) : '');
    setError(null);
    setMode('edit');
  };

  const handleCancel = () => {
    setValue(myIncomeSet ? String(myIncome) : '');
    setError(null);
    setMode('view');
  };

  const handleSave = async () => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid non-negative number.');
      return;
    }
    setError(null);
    try {
      await updateIncomeMutation.mutateAsync(parsed);
      setMode('view');
    } catch (err) {
      setError(extractApiError(err, 'Failed to save income. Please try again.'));
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <EyebrowLabel as="div">YOUR INCOME</EyebrowLabel>
          {mode === 'view' ? (
            myIncomeSet ? (
              <MoneyAmount
                amount={myIncome}
                currency={currency}
                size="lg"
                tone="neutral"
              />
            ) : (
              <span className="num text-2xl font-semibold text-ink-3">
                {'—'}
                {currency ? ` ${currency}` : ''}
              </span>
            )
          ) : null}
        </div>
        {mode === 'view' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="shrink-0"
          >
            Edit
          </Button>
        )}
      </div>

      {mode === 'edit' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="number"
              min={0}
              step={1}
              max={1000000}
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 w-32"
              disabled={updateIncomeMutation.isPending}
            />
            <span className="text-sm text-ink-3">{currency}</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={updateIncomeMutation.isPending}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateIncomeMutation.isPending || value === ''}
                className="h-9"
              >
                {updateIncomeMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
          {error && <p className="text-xs text-neg">{error}</p>}
        </div>
      )}

      {otherMembers.length > 0 && (
        <div className="border-t border-line pt-3 space-y-1">
          {otherMembers.map((m) => {
            const income = m.monthlyIncome;
            const pct =
              income !== undefined && totalIncome > 0
                ? Math.round((income / totalIncome) * 100)
                : null;
            return (
              <p key={m.userId} className="text-xs text-ink-3">
                {pct !== null
                  ? `${m.nickname} — ${pct}% of total`
                  : `${m.nickname} — income not set yet`}
              </p>
            );
          })}
        </div>
      )}
    </Card>
  );
}
