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
import { expenseApi } from '@/api/expense.api';
import { EXPENSE_TYPES } from '@/types/onboarding.types';
import type { HouseholdResponse } from '@/types/household.types';
import type { ExpenseResponse, AddExpenseInput } from '@/types/expense.types';

interface AddExpenseFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  household: HouseholdResponse;
  expense?: ExpenseResponse;
  onAdded: (e: ExpenseResponse) => void;
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
  onAdded,
}: AddExpenseFormProps) {
  const isEditMode = expense !== undefined;
  const payableMembers = household.members.filter(
    (m) => m.participatesInFinances && m.userId
  );

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState(expense?.category ?? EXPENSE_TYPES[0]);
  const [date, setDate] = useState(expense ? expense.date.slice(0, 10) : todayISO());
  const [paidByUserId, setPaidByUserId] = useState(expense?.paidByUserId ?? payableMembers[0]?.userId ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-populate form whenever the expense being edited changes
  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDate(expense.date.slice(0, 10));
      setPaidByUserId(expense.paidByUserId);
      setNotes(expense.notes ?? '');
      setError(null);
    }
  }, [expense?._id]);

  function resetForm() {
    setDescription('');
    setAmount('');
    setCategory(EXPENSE_TYPES[0]);
    setDate(todayISO());
    setPaidByUserId(payableMembers[0]?.userId ?? '');
    setNotes('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let saved: ExpenseResponse;
      if (isEditMode) {
        saved = await expenseApi.updateExpense(household._id, expense._id, {
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          date,
          paidByUserId,
          notes: notes.trim() || undefined,
        });
      } else {
        const input: AddExpenseInput = {
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          date,
          paidByUserId,
          ...(notes.trim() && { notes: notes.trim() }),
        };
        saved = await expenseApi.addExpense(household._id, input);
      }
      onAdded(saved);
      if (!isEditMode) resetForm();
      onOpenChange(false);
    } catch {
      setError(isEditMode ? 'Failed to update expense. Please try again.' : 'Failed to add expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const currency = household.settings.currency;
  const canSubmit = description.trim() && amount && !submitting;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{isEditMode ? 'Edit Expense' : 'Add Expense'}</SheetTitle>
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
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className={selectClass}
              disabled={submitting}
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {/* Paid by */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Paid by</label>
            <select
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
              className={selectClass}
              disabled={submitting}
            >
              {payableMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.nickname}
                </option>
              ))}
            </select>
          </div>

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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditMode ? 'Save Changes' : 'Add Expense'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
