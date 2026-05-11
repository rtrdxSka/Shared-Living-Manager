import { useCallback, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/contexts/DashboardContext';
import { useShoppingList, useArchiveBoughtShoppingItems, useBoughtShoppingItems } from '@/hooks/queries';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { computeDominantCategory } from '@/utils/computeDominantCategory';
import AddShoppingItemForm from '@/components/dashboard/shared/AddShoppingItemForm';
import ShoppingListView from '@/components/dashboard/shared/ShoppingListView';
import ShoppingHistoryView from '@/components/dashboard/shared/ShoppingHistoryView';
import DoneShoppingDialog from '@/components/dashboard/shared/DoneShoppingDialog';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import ShoppingFilterBar from '@/components/dashboard/shared/ShoppingFilterBar';
import AddRecurringItemForm from '@/components/dashboard/shared/AddRecurringItemForm';
import ConfirmDeleteDialog from '@/components/dashboard/shared/ConfirmDeleteDialog';
import LeaveShoppingPromptDialog from '@/components/dashboard/shared/LeaveShoppingPromptDialog';
import {
  useRecurringRules,
  useUpdateRecurringRule,
  useDeleteRecurringRule,
} from '@/hooks/queries/useRecurringShoppingItemQueries';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ExpenseType } from '@/types/onboarding.types';
import type { AddExpenseInput } from '@/types/expense.types';
import type { BoughtState, ShoppingListFilter, ShoppingListItemResponse } from '@/types/shoppingList.types';
import type { RecurringShoppingItemResponse } from '@/types/recurringShoppingItem.types';

const EMPTY_ITEMS: ShoppingListItemResponse[] = [];
const EMPTY_RULES: RecurringShoppingItemResponse[] = [];

export default function ShoppingListPage() {
  const {
    household,
    currentUserId,
    isAdmin,
  } = useDashboard();
  const householdId = household._id;

  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'recurring'>('active');

  // Session-local filter state (no URL sync). Shared between Active and History tabs
  // so a search typed on Active stays applied when switching to History.
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<ExpenseType[]>([]);
  const [boughtState, setBoughtState] = useState<BoughtState>('all');

  const filter: ShoppingListFilter = { search, categories, boughtState };
  const historyFilter = { search, categories };

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useShoppingList(householdId, filter);
  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? EMPTY_ITEMS,
    [data]
  );
  const { data: boughtItems = EMPTY_ITEMS } = useBoughtShoppingItems(householdId);
  const hasBought = boughtItems.length > 0;
  const dominantCategory = useMemo(() => computeDominantCategory(boughtItems), [boughtItems]);

  const archiveBought = useArchiveBoughtShoppingItems(householdId);
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItemResponse | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [expensePrefill, setExpensePrefill] = useState<Partial<AddExpenseInput> | null>(null);

  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringShoppingItemResponse | null>(null);
  const [pendingDeleteRule, setPendingDeleteRule] = useState<RecurringShoppingItemResponse | null>(null);

  const { data: rulesData, isLoading: rulesLoading } = useRecurringRules(householdId);
  const rules = rulesData?.items ?? EMPTY_RULES;

  const updateRule = useUpdateRecurringRule(householdId);
  const deleteRule = useDeleteRecurringRule(householdId);

  function handleToggleActive(rule: RecurringShoppingItemResponse) {
    updateRule.mutateAsync({ ruleId: rule._id, input: { active: !rule.active } }).catch(() => {
      window.alert('Failed to update recurring item. Please try again.');
    });
  }

  function handleDeleteRule(rule: RecurringShoppingItemResponse) {
    setPendingDeleteRule(rule);
  }

  const cadenceLabel = (c: 'daily' | 'weekly' | 'monthly') =>
    c === 'daily' ? 'Daily' : c === 'weekly' ? 'Weekly' : 'Monthly';

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

  const toggleCategory = (cat: ExpenseType) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleConvertConfirm = useCallback(() => {
    setExpensePrefill(buildPrefillFromBought(boughtItems));
    setExpenseSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boughtItems, currentUserId, dominantCategory]);

  // Hard nav guard via beforeunload (covers tab close, hard refresh, direct URL change)
  useBeforeUnload(boughtItems.length > 0);

  // In-app + browser back/forward guard via the data router.
  // Bypass channel: navigations that pass `state: { bypassBlocker: true }` (e.g. logout) skip the prompt.
  const isDirty = boughtItems.length > 0;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!isDirty) return false;
    if (currentLocation.pathname === nextLocation.pathname) return false;
    const state = nextLocation.state as { bypassBlocker?: boolean } | null;
    if (state?.bypassBlocker) return false;
    return true;
  });

  async function handleExpenseCreated(created: { _id: string }) {
    await archiveBought.mutateAsync({
      expenseId: created._id,
      dominantCategory,
    });
    // Honor the originally-attempted destination after a successful convert.
    if (blocker.state === 'blocked') blocker.proceed();
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'history' | 'recurring')}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-6">
          <ShoppingFilterBar
            search={search}
            onSearchChange={setSearch}
            selectedCategories={categories}
            onToggleCategory={toggleCategory}
            boughtState={boughtState}
            onBoughtStateChange={setBoughtState}
          />
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ShoppingListView
              householdId={householdId}
              items={items}
              onEditItem={setEditingItem}
              hasNextPage={hasNextPage ?? false}
              onLoadMore={() => { void fetchNextPage(); }}
              isFetchingNextPage={isFetchingNextPage}
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

        <TabsContent value="history" className="mt-4 space-y-4">
          <ShoppingFilterBar
            search={search}
            onSearchChange={setSearch}
            selectedCategories={categories}
            onToggleCategory={toggleCategory}
          />
          <ShoppingHistoryView householdId={householdId} filter={historyFilter} />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {rules.length === 0 ? 'No recurring items yet' : `${rules.length} recurring item${rules.length === 1 ? '' : 's'}`}
            </h2>
            <Button size="sm" onClick={() => { setEditingRule(null); setRecurringDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add recurring item
            </Button>
          </div>

          {rulesLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a recurring item to have it appear on your active list automatically.
            </p>
          ) : (
            <ul className="divide-y rounded-md border bg-card">
              {rules.map((rule) => (
                <li key={rule._id} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 truncate">{rule.name}</span>
                  <Badge variant="outline">{EXPENSE_TYPE_LABELS[rule.category]}</Badge>
                  <Badge variant="secondary">{cadenceLabel(rule.cadence)}</Badge>
                  <Switch
                    checked={rule.active}
                    onCheckedChange={() => handleToggleActive(rule)}
                    aria-label={rule.active ? 'Active — click to pause' : 'Paused — click to activate'}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setEditingRule(rule); setRecurringDialogOpen(true); }}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteRule(rule)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
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

      <AddRecurringItemForm
        open={recurringDialogOpen}
        onOpenChange={(o) => {
          setRecurringDialogOpen(o);
          if (!o) setEditingRule(null);
        }}
        householdId={householdId}
        rule={editingRule ?? undefined}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteRule !== null}
        onOpenChange={(o) => { if (!o) setPendingDeleteRule(null); }}
        title="Delete recurring item?"
        description={
          pendingDeleteRule
            ? `"${pendingDeleteRule.name}" will stop appearing on your active list automatically.`
            : undefined
        }
        onConfirm={async () => {
          if (!pendingDeleteRule) return;
          await deleteRule.mutateAsync(pendingDeleteRule._id);
          setPendingDeleteRule(null);
        }}
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

      <LeaveShoppingPromptDialog
        open={blocker.state === 'blocked' && !expenseSheetOpen}
        boughtCount={boughtItems.length}
        onConvertNow={handleConvertConfirm}
        onLeaveAnyway={() => blocker.proceed?.()}
      />
    </div>
  );
}
