import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useShoppingList, useClearBoughtShoppingItems } from '@/hooks/queries';
import AddShoppingItemForm from '@/components/dashboard/shared/AddShoppingItemForm';
import ShoppingListView from '@/components/dashboard/shared/ShoppingListView';
import DoneShoppingDialog from '@/components/dashboard/shared/DoneShoppingDialog';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import type { AddExpenseInput } from '@/types/expense.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

// Module-level stable empty array so the `items` fallback identity doesn't
// churn each render — keeps useMemo dep arrays stable when the list is empty.
const EMPTY_ITEMS: ShoppingListItemResponse[] = [];

export default function ShoppingListPage() {
  const {
    household,
    currentUserId,
    isAdmin,
    setShoppingListBoughtCount,
    setShoppingListConvertHandler,
  } = useDashboard();
  const householdId = household._id;

  const { data, isLoading } = useShoppingList(householdId);
  const items = data?.items ?? EMPTY_ITEMS;
  const boughtItems = useMemo(() => items.filter((i) => i.isBought), [items]);
  const hasBought = boughtItems.length > 0;

  const clearBought = useClearBoughtShoppingItems(householdId);

  const [addOpen, setAddOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [expensePrefill, setExpensePrefill] = useState<Partial<AddExpenseInput> | null>(null);

  function buildPrefillFromBought(bought: ShoppingListItemResponse[]): Partial<AddExpenseInput> {
    const description = bought
      .map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name))
      .join(', ');
    return {
      description,
      paidByUserId: currentUserId,
      category: 'groceries',
      date: new Date().toISOString().slice(0, 10),
    };
  }

  const handleConvertConfirm = useCallback(() => {
    setExpensePrefill(buildPrefillFromBought(boughtItems));
    setExpenseSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boughtItems, currentUserId]);

  // Push bought-count into context so AppLayout can detect dirty state
  useEffect(() => {
    setShoppingListBoughtCount(boughtItems.length);
    return () => setShoppingListBoughtCount(0);
  }, [boughtItems.length, setShoppingListBoughtCount]);

  // Register the convert handler so AppLayout's leave-guard can trigger it
  useEffect(() => {
    setShoppingListConvertHandler(() => handleConvertConfirm);
    return () => setShoppingListConvertHandler(null);
  }, [handleConvertConfirm, setShoppingListConvertHandler]);

  async function handleExpenseCreated() {
    await clearBought.mutateAsync();
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Shopping list</h1>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add item
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ShoppingListView householdId={householdId} items={items} />
      )}

      {hasBought && (
        <div className="sticky bottom-4 flex justify-end">
          <Button size="lg" onClick={() => setDoneOpen(true)}>
            Done shopping ({boughtItems.length})
          </Button>
        </div>
      )}

      <AddShoppingItemForm
        open={addOpen}
        onOpenChange={setAddOpen}
        householdId={householdId}
      />

      <DoneShoppingDialog
        open={doneOpen}
        onOpenChange={setDoneOpen}
        boughtItems={boughtItems}
        onConfirm={handleConvertConfirm}
      />

      {expensePrefill && (
        <AddExpenseForm
          open={expenseSheetOpen}
          onOpenChange={(open) => {
            setExpenseSheetOpen(open);
            if (!open) setExpensePrefill(null);
          }}
          household={household}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          initialValues={expensePrefill}
          onCreated={handleExpenseCreated}
        />
      )}
    </div>
  );
}
