import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { extractApiError } from '@/utils/extractApiError';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCreateRecurringRule,
  useUpdateRecurringRule,
  usePreviewRecurringMatches,
} from '@/hooks/queries/useRecurringShoppingItemQueries';
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from '@/types/onboarding.types';
import type {
  RecurrenceCadence,
  RecurringShoppingItemResponse,
} from '@/types/recurringShoppingItem.types';

const CADENCES: RecurrenceCadence[] = ['daily', 'weekly', 'monthly'];
const CADENCE_LABEL: Record<RecurrenceCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export interface AddRecurringItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  rule?: RecurringShoppingItemResponse;
}

export default function AddRecurringItemForm({
  open,
  onOpenChange,
  householdId,
  rule,
}: AddRecurringItemFormProps) {
  const isEdit = Boolean(rule);

  const [name, setName] = useState(rule?.name ?? '');
  const [category, setCategory] = useState<ExpenseType>(rule?.category ?? 'groceries');
  const [cadence, setCadence] = useState<RecurrenceCadence>(rule?.cadence ?? 'weekly');
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const createMutation = useCreateRecurringRule(householdId);
  const updateMutation = useUpdateRecurringRule(householdId);
  const previewMutation = usePreviewRecurringMatches(householdId);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Seed fields when opening with a different rule, or reset on close in add mode.
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setCategory(rule.category);
      setCadence(rule.cadence);
      setError(null);
      setPreviewError(null);
      previewMutation.reset();
      return;
    }
    if (!open) {
      setName('');
      setCategory('groceries');
      setCadence('weekly');
      setError(null);
      setPreviewError(null);
      previewMutation.reset();
    }
    // previewMutation.reset is a stable callback from React Query; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, open]);

  async function handlePreview() {
    setPreviewError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setPreviewError('Add at least one trigger word first');
      return;
    }
    try {
      await previewMutation.mutateAsync({
        triggerWords: [trimmed],
        category,
      });
    } catch (err) {
      setPreviewError(extractApiError(err, 'Failed to preview matches'));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }

    try {
      if (rule) {
        await updateMutation.mutateAsync({
          ruleId: rule._id,
          input: { name: trimmed, category, cadence },
        });
      } else {
        await createMutation.mutateAsync({ name: trimmed, category, cadence });
      }
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, isEdit ? 'Failed to update rule' : 'Failed to add rule'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit recurring item' : 'Add recurring item'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            We'll add this item to your active list automatically on the chosen cadence
            (skipping if it's already on the list).
          </p>

          <div>
            <label htmlFor="recurring-name" className="block text-sm font-medium mb-1">Name</label>
            <Input
              id="recurring-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Milk"
              maxLength={100}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="recurring-cat" className="block text-sm font-medium mb-1">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseType)}>
              <SelectTrigger id="recurring-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {EXPENSE_TYPE_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="recurring-cadence" className="block text-sm font-medium mb-1">Cadence</label>
            <Select value={cadence} onValueChange={(v) => setCadence(v as RecurrenceCadence)}>
              <SelectTrigger id="recurring-cadence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CADENCES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CADENCE_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* C6 / D18: dry-run preview of matching active items. */}
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                See which current shopping items match this rule's trigger.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending && (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                )}
                Preview matches
              </Button>
            </div>
            {previewError && (
              <p className="text-xs text-neg" role="alert">
                {previewError}
              </p>
            )}
            {previewMutation.data && !previewError && (
              <div className="text-xs">
                {previewMutation.data.matchedItems.length === 0 ? (
                  <p className="text-muted-foreground">
                    No current items match these words.
                  </p>
                ) : (
                  <>
                    <p className="font-medium">
                      Currently {previewMutation.data.matchedItems.length} item
                      {previewMutation.data.matchedItems.length === 1 ? '' : 's'} would match:
                    </p>
                    <ul className="mt-1 list-disc list-inside text-muted-foreground">
                      {previewMutation.data.matchedItems.map((item) => (
                        <li key={item._id}>{item.name}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-neg">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || name.trim().length === 0}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
