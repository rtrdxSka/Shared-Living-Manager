import { useNavigate } from 'react-router-dom';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useArchivedHistory,
  useRestoreShoppingItem,
  useDeleteShoppingItem,
} from '@/hooks/queries';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ExpenseType } from '@/types/onboarding.types';
import type { HistoryEntry } from '@/types/shoppingList.types';

export interface ShoppingHistoryViewProps {
  householdId: string;
  filter?: { search: string; categories: ExpenseType[] };
}

export default function ShoppingHistoryView({ householdId, filter }: ShoppingHistoryViewProps) {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useArchivedHistory(householdId, filter);

  const restore = useRestoreShoppingItem(householdId);
  const remove = useDeleteShoppingItem(householdId);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entries: HistoryEntry[] = data?.pages.flatMap((p) => p.entries) ?? [];

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No history yet. Items appear here after you mark them bought and convert to an expense, or after archiving from the active list.
      </div>
    );
  }

  function handleDeleteEntry(entry: HistoryEntry) {
    Promise.all(entry.items.map((i) => remove.mutateAsync(i._id))).catch(() => {
      // Errors surfaced by the mutation's onError; no extra handling needed here.
    });
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => (
        <div
          key={entry.type === 'trip' ? `trip:${entry.expenseId}` : `manual:${entry.items[0]._id}:${idx}`}
          className="rounded-md border bg-card p-4"
        >
          {entry.type === 'trip' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/expenses')}
                  className="flex flex-col items-start text-left hover:underline"
                >
                  <span className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                    {new Date(entry.archivedAt).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-semibold">
                    {entry.items.length} {entry.items.length === 1 ? 'item' : 'items'} · {EXPENSE_TYPE_LABELS[entry.dominantCategory]} · View expense
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteEntry(entry)}
                  aria-label="Hard-delete this trip from history"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {entry.items.map((item) => (
                  <li key={item._id} className="flex items-center gap-2 text-muted-foreground">
                    <span>{item.quantity ? `${item.quantity} ` : ''}{item.name}</span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      {EXPENSE_TYPE_LABELS[item.category]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  {entry.items[0].quantity ? `${entry.items[0].quantity} ` : ''}{entry.items[0].name}
                  <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {EXPENSE_TYPE_LABELS[entry.items[0].category]}
                  </span>
                </p>
                <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                  Archived {new Date(entry.archivedAt).toLocaleDateString()}
                </p>
                {entry.items[0].notes && (
                  <p className="text-xs text-muted-foreground truncate">{entry.items[0].notes}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => restore.mutate(entry.items[0]._id)}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Restore
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(entry.items[0]._id)}
                aria-label="Delete archived item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
