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
import { useAddShoppingItem } from '@/hooks/queries';

interface AddShoppingItemFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
}

export default function AddShoppingItemForm({
  open,
  onOpenChange,
  householdId,
}: AddShoppingItemFormProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addMutation = useAddShoppingItem(householdId);
  const submitting = addMutation.isPending;

  // Reset form when the sheet closes
  useEffect(() => {
    if (!open) {
      setName('');
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }

    try {
      await addMutation.mutateAsync({
        name: trimmed,
        ...(quantity.trim() && { quantity: quantity.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
      });
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, 'Failed to add item'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add shopping item</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="shop-name" className="block text-sm font-medium mb-1">
              Name
            </label>
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
            <label htmlFor="shop-qty" className="block text-sm font-medium mb-1">
              Quantity (optional)
            </label>
            <Input
              id="shop-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2L, 1 dozen"
              maxLength={50}
            />
          </div>

          <div>
            <label htmlFor="shop-notes" className="block text-sm font-medium mb-1">
              Notes (optional)
            </label>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add item
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
