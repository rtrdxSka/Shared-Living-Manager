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
import { useDashboard } from '@/contexts/useDashboard';
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
  initialValues?: Partial<AddExpenseInput>;  // prefill in create mode (ignored when `expense` is provided)
  onCreated?: (expense: ExpenseResponse) => void;  // optional callback fired after a successful create
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddExpenseForm({
  open,
  onOpenChange,
  household,
  expense,
  initialValues,
  onCreated,
}: AddExpenseFormProps) {
  const { uiMode, financeMode, splitMethod } = useDashboard();
  const isEditMode = expense !== undefined;
  const payableMembers = household.members.filter(
    (m) => m.participatesInFinances && m.userId
  );
  const dropdownMembers = payableMembers;

  const [description, setDescription] = useState(expense?.description ?? initialValues?.description ?? '');
  const [amount, setAmount] = useState(
    expense ? String(expense.amount) : initialValues?.amount != null ? String(initialValues.amount) : ''
  );
  const [category, setCategory] = useState(expense?.category ?? initialValues?.category ?? EXPENSE_TYPES[0]);
  const [date, setDate] = useState(
    expense ? expense.date.slice(0, 10) : (initialValues?.date ?? todayISO())
  );
  const [paidByUserId, setPaidByUserId] = useState(expense?.paidByUserId ?? initialValues?.paidByUserId ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? initialValues?.notes ?? '');
  const [splitMode, setSplitMode] = useState<'default' | 'full'>(
    expense?.isFullRepayment ? 'full' : initialValues?.isFullRepayment ? 'full' : 'default'
  );
  const [error, setError] = useState<string | null>(null);

  // Participants (roommates only). Default to "everyone" — i.e. all payable members
  // checked. Submit logic compares length against payableMembers and omits the
  // field on the payload when the whole household is selected so this stays a
  // pure superset of existing behavior for couple/solo.
  const allPayableIds = payableMembers
    .map((m) => m.userId)
    .filter((id): id is string => Boolean(id));
  const [participants, setParticipants] = useState<string[]>(() => {
    if (expense?.participantUserIds && expense.participantUserIds.length > 0) {
      return expense.participantUserIds;
    }
    if (initialValues?.participantUserIds && initialValues.participantUserIds.length > 0) {
      return initialValues.participantUserIds;
    }
    return allPayableIds;
  });

  const toggleParticipant = (uid: string) => {
    setParticipants((prev) => {
      const next = prev.includes(uid) ? prev.filter((p) => p !== uid) : [...prev, uid];
      // If the current payer was just removed from participants, clear it so we
      // don't submit an expense paid by someone who isn't sharing it.
      if (paidByUserId && !next.includes(paidByUserId)) {
        setPaidByUserId('');
      }
      return next;
    });
  };

  // Per-participant custom percentages (roommates + splitMethod=custom only).
  // Prefilled from `expense.customSplitOverrides` in edit mode, otherwise
  // initialized evenly across current participants on mount and whenever the
  // selected participants change. Stored as a {userId: pct} map for easy
  // lookup/update; converted to the array shape at submit time.
  const [customPcts, setCustomPcts] = useState<Record<string, number>>(() => {
    if (expense?.customSplitOverrides && expense.customSplitOverrides.length > 0) {
      const init: Record<string, number> = {};
      for (const o of expense.customSplitOverrides) init[o.userId] = o.pct;
      return init;
    }
    return {};
  });

  // Recurring state (not available in edit mode)
  const [isRecurring, setIsRecurring] = useState(false);
  const [interval, setInterval] = useState<RecurrenceInterval>('monthly');
  const [payerMode, setPayerMode] = useState<PayerMode>('open_to_claim');

  const addExpenseMutation = useAddExpense(household._id);
  const updateExpenseMutation = useUpdateExpense(household._id);
  const createRecurringMutation = useCreateRecurringExpense(household._id);

  const submitting = addExpenseMutation.isPending || updateExpenseMutation.isPending || createRecurringMutation.isPending;

  // Re-initialize the per-participant custom percentages whenever the
  // participants list, uiMode, or splitMethod change. In edit mode, on the
  // first render we keep whatever was loaded from `expense.customSplitOverrides`
  // (handled by the useState initializer above). Subsequent participant
  // toggles fall through to the even-split branch.
  useEffect(() => {
    if (uiMode !== 'roommates' || splitMethod !== 'custom') {
      setCustomPcts({});
      return;
    }
    setCustomPcts((prev) => {
      const n = participants.length;
      if (n === 0) return {};
      // If the existing map already covers exactly the current participant set,
      // preserve user-entered values rather than blowing them away on unrelated
      // re-renders.
      const prevKeys = Object.keys(prev);
      const sameSet =
        prevKeys.length === n && participants.every((p) => prev[p] !== undefined);
      if (sameSet) return prev;
      const evenly = Math.floor(100 / n);
      const remainder = 100 - evenly * n;
      const init: Record<string, number> = {};
      participants.forEach((uid, i) => {
        init[uid] = evenly + (i === 0 ? remainder : 0);
      });
      return init;
    });
  }, [uiMode, splitMethod, participants]);

  const pctSum = Object.values(customPcts).reduce(
    (s, n) => s + (Number.isFinite(n) ? n : 0),
    0
  );
  const customActive = uiMode === 'roommates' && splitMethod === 'custom';
  const customValid = !customActive || pctSum === 100;

  // Re-populate form whenever the expense being edited or initialValues prefill changes,
  // or when the sheet opens in create mode with prefill data.
  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDate(expense.date.slice(0, 10));
      setPaidByUserId(expense.paidByUserId ?? '');
      setNotes(expense.notes ?? '');
      setSplitMode(expense.isFullRepayment ? 'full' : 'default');
      setParticipants(
        expense.participantUserIds && expense.participantUserIds.length > 0
          ? expense.participantUserIds
          : allPayableIds
      );
      if (expense.customSplitOverrides && expense.customSplitOverrides.length > 0) {
        const init: Record<string, number> = {};
        for (const o of expense.customSplitOverrides) init[o.userId] = o.pct;
        setCustomPcts(init);
      } else {
        setCustomPcts({});
      }
      setError(null);
      return;
    }
    if (open && initialValues) {
      if (initialValues.description !== undefined) setDescription(initialValues.description);
      if (initialValues.amount !== undefined) setAmount(String(initialValues.amount));
      if (initialValues.category !== undefined) setCategory(initialValues.category);
      if (initialValues.date !== undefined) setDate(initialValues.date);
      if (initialValues.paidByUserId !== undefined) setPaidByUserId(initialValues.paidByUserId);
      if (initialValues.notes !== undefined) setNotes(initialValues.notes);
      if (initialValues.isFullRepayment !== undefined) {
        setSplitMode(initialValues.isFullRepayment ? 'full' : 'default');
      }
      if (initialValues.participantUserIds && initialValues.participantUserIds.length > 0) {
        setParticipants(initialValues.participantUserIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, open]);

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
    setSplitMode('default');
    setIsRecurring(false);
    setInterval('monthly');
    setPayerMode('open_to_claim');
    setParticipants(allPayableIds);
    setCustomPcts({});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // When the user has every payable member checked, treat that as "everyone"
    // and omit the field so the backend uses its default member set. Only when a
    // strict subset is selected do we send participantUserIds. Note the selector
    // itself is only rendered in roommates mode, so couple/solo flows always
    // see `participants.length === allPayableIds.length` here.
    const subgroupSelected =
      participants.length > 0 && participants.length < allPayableIds.length;
    const participantUserIds = subgroupSelected ? participants : undefined;
    // Only send customSplitOverrides for roommates + splitMethod=custom and
    // when there's at least one participant selected. The array always covers
    // exactly the currently selected participants (the same set the backend
    // sees as the subgroup, or the full household when no subgroup is set).
    const customSplitOverrides =
      customActive && participants.length > 0
        ? participants.map((uid) => ({ userId: uid, pct: customPcts[uid] ?? 0 }))
        : undefined;
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
            isFullRepayment: splitMode === 'full',
            // Edit mode supports clearing the subgroup explicitly: send `null`
            // when the user re-checked everyone so the backend wipes the field.
            participantUserIds: subgroupSelected ? participants : null,
            ...(customSplitOverrides && { customSplitOverrides }),
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
          isFullRepayment: splitMode === 'full',
          ...(participantUserIds && { participantUserIds }),
          ...(customSplitOverrides && { customSplitOverrides }),
        });
      } else {
        const input: AddExpenseInput = {
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          date,
          ...(paidByUserId && { paidByUserId }),
          ...(notes.trim() && { notes: notes.trim() }),
          isFullRepayment: splitMode === 'full',
          ...(participantUserIds && { participantUserIds }),
          ...(customSplitOverrides && { customSplitOverrides }),
        };
        const created = await addExpenseMutation.mutateAsync(input);
        if (onCreated) onCreated(created);
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
  const showPaidBy = isEditMode || (!isRecurring) || (isRecurring && payerMode === 'fixed');
  const paidByRequired = (isRecurring && payerMode === 'fixed') || financeMode === 'joint';

  const canSubmit =
    description.trim() &&
    amount &&
    !submitting &&
    !(paidByRequired && !paidByUserId) &&
    customValid;

  const dateLabel = isRecurring ? 'STARTS FROM' : 'DATE';

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
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              DESCRIPTION
            </label>
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
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              AMOUNT ({currency})
            </label>
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
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              CATEGORY
            </label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)} disabled={submitting}>
              <SelectTrigger>
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
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              {dateLabel}
            </label>
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
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isRecurring
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line bg-surface-2 text-ink-3 hover:border-line-2 hover:text-ink'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isRecurring ? 'Recurring (on)' : 'Make this recurring'}
                </button>
              </div>

              {isRecurring && (
                <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3">
                  {/* Interval */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                      INTERVAL
                    </label>
                    <div className="flex gap-2">
                      {RECURRENCE_INTERVALS.map((iv) => (
                        <button
                          key={iv}
                          type="button"
                          onClick={() => setInterval(iv)}
                          disabled={submitting}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            interval === iv
                              ? 'border-accent bg-accent text-accent-ink'
                              : 'border-line bg-surface text-ink-3 hover:border-line-2 hover:text-ink'
                          }`}
                        >
                          {iv.charAt(0).toUpperCase() + iv.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payer mode */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                      PAYER
                    </label>
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
                              ? 'border-accent bg-accent text-accent-ink'
                              : 'border-line bg-surface text-ink-3 hover:border-line-2 hover:text-ink'
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
              <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                PAID BY{!paidByRequired && <span className="normal-case tracking-normal font-sans text-ink-3"> (optional)</span>}
              </label>
              <Select
                value={paidByUserId || '__none__'}
                onValueChange={(v) => setPaidByUserId(v === '__none__' ? '' : v)}
                disabled={submitting}
              >
                <SelectTrigger>
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

          {/* Participants — roommates only. Couple/solo always split with everyone. */}
          {uiMode === 'roommates' && payableMembers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                WHO SHARES THIS?
              </label>
              <p className="-mt-1 text-xs text-ink-3">
                Leave all checked to split with the whole household.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {payableMembers.map((m) => {
                  const uid = m.userId!;
                  return (
                    <label key={uid} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={participants.includes(uid)}
                        onChange={() => toggleParticipant(uid)}
                        aria-label={m.nickname}
                        disabled={submitting}
                        className="h-4 w-4 rounded border-line"
                      />
                      <span>{m.nickname}</span>
                    </label>
                  );
                })}
              </div>
              {financeMode === 'joint' && (
                <p className="text-xs text-amber-600">
                  In joint mode, this is informational — the joint account still pays.
                </p>
              )}
            </div>
          )}

          {/* Custom percentages — roommates + splitMethod=custom only. */}
          {customActive && participants.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                CUSTOM PERCENTAGES
              </label>
              <div className="flex flex-col gap-2">
                {participants.map((uid) => {
                  const m = payableMembers.find((pm) => pm.userId === uid);
                  if (!m) return null;
                  return (
                    <div key={uid} className="flex items-center gap-2">
                      <span className="w-20 text-sm">{m.nickname}</span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={customPcts[uid] ?? 0}
                        onChange={(e) =>
                          setCustomPcts((prev) => ({
                            ...prev,
                            [uid]: parseInt(e.target.value || '0', 10),
                          }))
                        }
                        aria-label={`${m.nickname} %`}
                        disabled={submitting}
                        className="w-24"
                      />
                      <span className="text-sm text-ink-3">%</span>
                    </div>
                  );
                })}
              </div>
              <p className={pctSum === 100 ? 'text-xs text-green-600' : 'text-xs text-amber-600'}>
                Total: {pctSum}%
                {pctSum !== 100 &&
                  ` (${pctSum < 100 ? `${100 - pctSum}% remaining` : `${pctSum - 100}% over`})`}
              </p>
            </div>
          )}

          {/* Split — couple+split only (joint mode has no debt; solo has no other member) */}
          {uiMode === 'couple' && financeMode === 'split' && (
            <div className="flex flex-col gap-1.5">
              <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
                SPLIT
              </label>
              <Select value={splitMode} onValueChange={(v) => setSplitMode(v as 'default' | 'full')} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (household method)</SelectItem>
                  <SelectItem value="full">Full repayment by other member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="block mb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-3">
              NOTES <span className="normal-case tracking-normal font-sans text-ink-3">(optional)</span>
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Any additional details…"
              disabled={submitting}
            />
          </div>

          {error && <p className="text-xs text-neg mt-1">{error}</p>}

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
