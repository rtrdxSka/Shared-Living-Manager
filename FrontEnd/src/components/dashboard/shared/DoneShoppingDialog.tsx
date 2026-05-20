import { Button } from '@/components/ui/button';
import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface DoneShoppingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boughtItems: ShoppingListItemResponse[];
  dominantCategory: ExpenseType;
  onConfirm: () => void;
}

export default function DoneShoppingDialog({
  open,
  onOpenChange,
  boughtItems,
  dominantCategory,
  onConfirm,
}: DoneShoppingDialogProps) {
  if (!open) return null;

  const grouped = new Map<ExpenseType, ShoppingListItemResponse[]>();
  for (const item of boughtItems) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category)!.push(item);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Done shopping?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {boughtItems.length === 1
            ? `We'll convert this 1 bought item into a single ${EXPENSE_TYPE_LABELS[dominantCategory].toUpperCase()} expense.`
            : `We'll convert these ${boughtItems.length} bought items into a single ${EXPENSE_TYPE_LABELS[dominantCategory].toUpperCase()} expense.`}
        </p>

        <div className="mt-4 max-h-48 space-y-3 overflow-auto rounded-md border bg-card p-3 text-sm">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                {EXPENSE_TYPE_LABELS[cat]}
              </p>
              <ul className="mt-1 space-y-0.5">
                {items.map((item) => (
                  <li key={item._id}>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
