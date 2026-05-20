import { useState } from 'react';
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
import { useAddShoppingItem, useUpdateShoppingItem } from '@/hooks/queries';
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface AddShoppingItemFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  item?: ShoppingListItemResponse;  // present in edit mode
}

export default function AddShoppingItemForm({
  open,
  onOpenChange,
  householdId,
  item,
}: AddShoppingItemFormProps) {
  const isEditMode = item !== undefined;

  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [category, setCategory] = useState<ExpenseType>(item?.category ?? 'groceries');
  const [error, setError] = useState<string | null>(null);

  const addMutation = useAddShoppingItem(householdId);
  const updateMutation = useUpdateShoppingItem(householdId);
  const submitting = addMutation.isPending || updateMutation.isPending;

  // Hydrate from `item` when it changes (parent switches edit targets) or reset when sheet closes in add mode.
  // Uses the "previous value during render" pattern to avoid setState-in-effect.
  const [prevItem, setPrevItem] = useState(item);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevItem !== item || prevOpen !== open) {
    setPrevItem(item);
    setPrevOpen(open);
    if (item) {
      setName(item.name);
      setQuantity(item.quantity ?? '');
      setNotes(item.notes ?? '');
      setCategory(item.category);
      setError(null);
    } else if (!open) {
      setName('');
      setQuantity('');
      setNotes('');
      setCategory('groceries');
      setError(null);
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
      if (isEditMode && item) {
        await updateMutation.mutateAsync({
          itemId: item._id,
          input: {
            name: trimmed,
            quantity: quantity.trim(),
            notes: notes.trim(),
            category,
          },
        });
      } else {
        await addMutation.mutateAsync({
          name: trimmed,
          ...(quantity.trim() && { quantity: quantity.trim() }),
          ...(notes.trim() && { notes: notes.trim() }),
          category,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, isEditMode ? 'Failed to update item' : 'Failed to add item'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit shopping item' : 'Add shopping item'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="shop-name" className="block text-sm font-medium mb-1">Name</label>
            <Input
              id="shop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. milk"
              maxLength={100}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="shop-qty" className="block text-sm font-medium mb-1">Quantity (optional)</label>
            <Input
              id="shop-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2L, 1 dozen"
              maxLength={50}
            />
          </div>

          <div>
            <label htmlFor="shop-cat" className="block text-sm font-medium mb-1">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseType)}>
              <SelectTrigger id="shop-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="shop-notes" className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              id="shop-notes"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. whole milk only"
            />
          </div>

          {error && <p className="text-sm text-neg">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Save changes' : 'Add item'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
