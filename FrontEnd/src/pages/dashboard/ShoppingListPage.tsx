import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDashboard } from '@/contexts/DashboardContext';
import { useShoppingList, useArchiveBoughtShoppingItems } from '@/hooks/queries';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { computeDominantCategory } from '@/utils/computeDominantCategory';
import AddShoppingItemForm from '@/components/dashboard/shared/AddShoppingItemForm';
import ShoppingListView from '@/components/dashboard/shared/ShoppingListView';
import ShoppingHistoryView from '@/components/dashboard/shared/ShoppingHistoryView';
import DoneShoppingDialog from '@/components/dashboard/shared/DoneShoppingDialog';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { AddExpenseInput } from '@/types/expense.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

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
  const dominantCategory = useMemo(() => computeDominantCategory(boughtItems), [boughtItems]);

  const archiveBought = useArchiveBoughtShoppingItems(householdId);

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItemResponse | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [expensePrefill, setExpensePrefill] = useState<Partial<AddExpenseInput> | null>(null);

  // Build the description that pre-fills the expense form, grouping items by category.
  function buildPrefillFromBought(bought: ShoppingListItemResponse[]): Partial<AddExpenseInput> {
    const grouped = new Map<string, string[]>();
    for (const item of bought) {
      const piece = item.quantity ? `${item.quantity} ${item.name}` : item.name;
      if (!grouped.has(item.category)) grouped.set(item.category, []);
      grouped.get(item.category)!.push(piece);
    }
    const description = Array.from(grouped.entries())
      .map(([cat, names]) => `${EXPENSE_TYPE_LABELS[cat as keyof typeof EXPENSE_TYPE_LABELS].toUpperCase()}: ${names.join(', ')}`)
      .join(' · ');

    return {
      description,
      paidByUserId: currentUserId,
      category: dominantCategory,
      date: new Date().toISOString().slice(0, 10),
    };
  }

  const handleConvertConfirm = useCallback(() => {
    setExpensePrefill(buildPrefillFromBought(boughtItems));
    setExpenseSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boughtItems, currentUserId, dominantCategory]);

  // Push bought-count into context (sidebar leave-guard)
  useEffect(() => {
    setShoppingListBoughtCount(boughtItems.length);
    return () => setShoppingListBoughtCount(0);
  }, [boughtItems.length, setShoppingListBoughtCount]);

  // Register the convert handler for the in-app sidebar leave-guard
  useEffect(() => {
    setShoppingListConvertHandler(() => handleConvertConfirm);
    return () => setShoppingListConvertHandler(null);
  }, [setShoppingListConvertHandler, handleConvertConfirm]);

  // Hard nav guard via beforeunload (covers tab close, hard refresh, direct URL change)
  useBeforeUnload(boughtItems.length > 0);

  async function handleExpenseCreated(created: { _id: string }) {
    await archiveBought.mutateAsync({
      expenseId: created._id,
      dominantCategory,
    });
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'history')}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ShoppingListView
              householdId={householdId}
              items={items}
              onEditItem={setEditingItem}
            />
          )}

          {hasBought && (
            <div className="sticky bottom-4 flex justify-end">
              <Button size="lg" onClick={() => setDoneOpen(true)}>
                Done shopping ({boughtItems.length})
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ShoppingHistoryView householdId={householdId} />
        </TabsContent>
      </Tabs>

      <AddShoppingItemForm
        open={addOpen || editingItem !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditingItem(null);
          }
        }}
        householdId={householdId}
        item={editingItem ?? undefined}
      />

      <DoneShoppingDialog
        open={doneOpen}
        onOpenChange={setDoneOpen}
        boughtItems={boughtItems}
        dominantCategory={dominantCategory}
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
