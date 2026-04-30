import { Button } from '@/components/ui/button';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface DoneShoppingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boughtItems: ShoppingListItemResponse[];
  onConfirm: () => void;
}

export default function DoneShoppingDialog({
  open,
  onOpenChange,
  boughtItems,
  onConfirm,
}: DoneShoppingDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Done shopping?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {boughtItems.length === 1
            ? "We'll convert this 1 bought item into an expense."
            : `We'll convert these ${boughtItems.length} bought items into a single expense.`}
        </p>

        <ul className="mt-4 max-h-48 space-y-1 overflow-auto rounded-md border bg-card p-3 text-sm">
          {boughtItems.map((item) => (
            <li key={item._id}>
              {item.quantity ? `${item.quantity} ` : ''}
              {item.name}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Open expense form
          </Button>
        </div>
      </div>
    </div>
  );
}
