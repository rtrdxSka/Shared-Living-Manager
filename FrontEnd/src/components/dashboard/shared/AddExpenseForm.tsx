import { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { extractApiError } from '@/utils/extractApiError';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAddExpense, useUpdateExpense, useCreateRecurringExpense } from '@/hooks/queries';
import { EXPENSE_TYPES } from '@/types/onboarding.types';
import { RECURRENCE_INTERVALS, PAYER_MODES } from '@/types/recurring-expense.types';
import type { HouseholdResponse } from '@/types/household.types';
import type { ExpenseResponse, AddExpenseInput } from '@/types/expense.types';
import type { RecurrenceInterval, PayerMode } from '@/types/recurring-expense.types';

interface AddExpenseFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  household: HouseholdResponse;
  expense?: ExpenseResponse;
  isAdmin: boolean;
  currentUserId: string;
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddExpenseForm({
  open,
  onOpenChange,
  household,
  expense,
  isAdmin,
  currentUserId,
}: AddExpenseFormProps) {
  const isEditMode = expense !== undefined;
  const payableMembers = household.members.filter(
    (m) => m.participatesInFinances && m.userId
  );
  const dropdownMembers = isAdmin
    ? payableMembers
    : payableMembers.filter((m) => m.userId === currentUserId);

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState(expense?.category ?? EXPENSE_TYPES[0]);
  const [date, setDate] = useState(expense ? expense.date.slice(0, 10) : todayISO());
  const [paidByUserId, setPaidByUserId] = useState(expense?.paidByUserId ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  // Recurring state (not available in edit mode)
  const [isRecurring, setIsRecurring] = useState(false);
  const [interval, setInterval] = useState<RecurrenceInterval>('monthly');
  const [payerMode, setPayerMode] = useState<PayerMode>('open_to_claim');

  const addExpenseMutation = useAddExpense(household._id);
  const updateExpenseMutation = useUpdateExpense(household._id);
  const createRecurringMutation = useCreateRecurringExpense(household._id);

  const submitting = addExpenseMutation.isPending || updateExpenseMutation.isPending || createRecurringMutation.isPending;

  // Re-populate form whenever the expense being edited changes
  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDate(expense.date.slice(0, 10));
      setPaidByUserId(expense.paidByUserId ?? '');
      setNotes(expense.notes ?? '');
      setError(null);
    }
  }, [expense?._id]);

  // Reset all fields when the sheet is dismissed
  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  function resetForm() {
    setDescription('');
    setAmount('');
    setCategory(EXPENSE_TYPES[0]);
    setDate(todayISO());
    setPaidByUserId('');
    setNotes('');
    setIsRecurring(false);
    setInterval('monthly');
    setPayerMode('open_to_claim');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEditMode) {
        await updateExpenseMutation.mutateAsync({
          expenseId: expense._id,
          input: {
            description: description.trim(),
            amount: parseFloat(amount),
            category,
            date,
            paidByUserId: paidByUserId || null,
            notes: notes.trim() || undefined,
          },
        });
      } else if (isRecurring) {
        await createRecurringMutation.mutateAsync({
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          notes: notes.trim() || undefined,
          interval,
          payerMode,
          ...(payerMode === 'fixed' && paidByUserId ? { fixedPayerUserId: paidByUserId } : {}),
        });
      } else {
        const input: AddExpenseInput = {
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          date,
          ...(paidByUserId && { paidByUserId }),
          ...(notes.trim() && { notes: notes.trim() }),
        };
        await addExpenseMutation.mutateAsync(input);
      }
      if (!isEditMode) resetForm();
      onOpenChange(false);
    } catch (error) {
      setError(extractApiError(
        error,
        isEditMode
          ? 'Failed to update expense. Please try again.'
          : isRecurring
            ? 'Failed to create recurring template. Please try again.'
            : 'Failed to add expense. Please try again.'
      ));
    }
  }

  const currency = household.settings.currency;
  const canSubmit =
    description.trim() &&
    amount &&
    !submitting &&
    !(isRecurring && payerMode === 'fixed' && !paidByUserId);

  const showPaidBy = isEditMode || (!isRecurring) || (isRecurring && payerMode === 'fixed');
  const paidByRequired = isRecurring && payerMode === 'fixed';

  const dateLabel = isRecurring ? 'Starts from' : 'Date';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>
            {isEditMode ? 'Edit Expense' : isRecurring ? 'New Recurring Template' : 'Add Expense'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
              placeholder="e.g. Monthly rent"
              required
              disabled={submitting}
            />
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Amount ({currency})</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              max="1000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              disabled={submitting}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)} disabled={submitting}>
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date / Starts from */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{dateLabel}</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required={!isRecurring}
              disabled={submitting}
            />
          </div>

          {/* Recurring options — only when not in edit mode */}
          {!isEditMode && (
            <>
              {/* Make recurring toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecurring((r) => !r)}
                  disabled={submitting}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isRecurring
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isRecurring ? 'Recurring (on)' : 'Make this recurring'}
                </button>
              </div>

              {isRecurring && (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  {/* Interval */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Interval</label>
                    <div className="flex gap-2">
                      {RECURRENCE_INTERVALS.map((iv) => (
                        <button
                          key={iv}
                          type="button"
                          onClick={() => setInterval(iv)}
                          disabled={submitting}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            interval === iv
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-transparent hover:bg-muted'
                          }`}
                        >
                          {iv.charAt(0).toUpperCase() + iv.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payer mode */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payer</label>
                    <div className="flex gap-2">
                      {PAYER_MODES.map((pm) => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => {
                            setPayerMode(pm);
                            if (pm === 'open_to_claim') setPaidByUserId('');
                          }}
                          disabled={submitting}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            payerMode === pm
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-transparent hover:bg-muted'
                          }`}
                        >
                          {pm === 'fixed' ? 'Fixed payer' : 'Open to claim'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Paid by — shown for edit mode, non-recurring, or recurring+fixed */}
          {showPaidBy && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Paid by{!paidByRequired && <span className="text-muted-foreground"> (optional)</span>}
              </label>
              <Select
                value={paidByUserId || '__none__'}
                onValueChange={(v) => setPaidByUserId(v === '__none__' ? '' : v)}
                disabled={submitting}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!paidByRequired && <SelectItem value="__none__">Not paid yet</SelectItem>}
                  {dropdownMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId!}>{m.nickname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Any additional details…"
              disabled={submitting}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={!canSubmit} className="mt-2">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditMode ? (
              'Save Changes'
            ) : isRecurring ? (
              'Create Template'
            ) : (
              'Add Expense'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
