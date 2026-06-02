import { useState } from 'react';
import { Pencil, Archive, Trash2 } from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ConfirmDeleteDialog from '@/components/dashboard/shared/ConfirmDeleteDialog';
import {
  useToggleShoppingItemBought,
  useArchiveShoppingItem,
  useDeleteShoppingItem,
} from '@/hooks/queries';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface ShoppingListViewProps {
  householdId: string;
  items: ShoppingListItemResponse[];
  onEditItem: (item: ShoppingListItemResponse) => void;
  hasNextPage: boolean;
  onLoadMore: () => void;
  isFetchingNextPage: boolean;
}

export default function ShoppingListView({
  householdId,
  items,
  onEditItem,
  hasNextPage,
  onLoadMore,
  isFetchingNextPage,
}: ShoppingListViewProps) {
  const toggle = useToggleShoppingItemBought(householdId);
  const archive = useArchiveShoppingItem(householdId);
  const remove = useDeleteShoppingItem(householdId);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<ShoppingListItemResponse | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Your shopping list is empty. Add an item to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <LayoutGroup>
        <motion.ul layout className="divide-y rounded-md border">
          {items.map((item) => (
            <motion.li
              key={item._id}
              layout
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={`flex items-center gap-3 p-3 transition-colors duration-200 ${
                item.isBought ? 'opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={item.isBought}
                onChange={() => toggle.mutate(item._id)}
                className="h-4 w-4 cursor-pointer"
                aria-label={`Mark ${item.name} as bought`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${item.isBought ? 'line-through text-muted-foreground' : ''}`}>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.name}
                  </p>
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {EXPENSE_TYPE_LABELS[item.category]}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onEditItem(item)}
                aria-label={`Edit ${item.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => archive.mutate(item._id)}
                aria-label={`Archive ${item.name}`}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPendingDeleteItem(item)}
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.li>
          ))}
        </motion.ul>
      </LayoutGroup>
      {hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteItem !== null}
        onOpenChange={(o) => { if (!o) setPendingDeleteItem(null); }}
        title="Delete item?"
        description={
          pendingDeleteItem
            ? `"${pendingDeleteItem.name}" will be removed permanently. Use Archive if you want to keep it in history.`
            : undefined
        }
        onConfirm={async () => {
          if (!pendingDeleteItem) return;
          await remove.mutateAsync(pendingDeleteItem._id);
          setPendingDeleteItem(null);
        }}
      />
    </div>
  );
}
