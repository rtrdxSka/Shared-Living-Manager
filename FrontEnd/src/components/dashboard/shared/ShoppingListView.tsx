import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useToggleShoppingItemBought,
  useDeleteShoppingItem,
} from '@/hooks/queries';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface ShoppingListViewProps {
  householdId: string;
  items: ShoppingListItemResponse[];
}

export default function ShoppingListView({ householdId, items }: ShoppingListViewProps) {
  const toggle = useToggleShoppingItemBought(householdId);
  const remove = useDeleteShoppingItem(householdId);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Your shopping list is empty. Add an item to get started.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {items.map((item) => (
        <li key={item._id} className="flex items-center gap-3 p-3">
          <input
            type="checkbox"
            checked={item.isBought}
            onChange={() => toggle.mutate(item._id)}
            className="h-4 w-4 cursor-pointer"
            aria-label={`Mark ${item.name} as bought`}
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${item.isBought ? 'line-through text-muted-foreground' : ''}`}>
              {item.quantity ? `${item.quantity} ` : ''}
              {item.name}
            </p>
            {item.notes && (
              <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove.mutate(item._id)}
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
