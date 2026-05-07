# Shopping List Pagination — Design Spec

**Date:** 2026-05-07
**Branch:** `5-implement-couple-dashboard-and-algorithms`
**Status:** Approved (awaiting implementation plan)

## Context

The recent backend hardening pass added `.limit(500)` safety caps to both `listItems` (active list) and `listArchivedHistory` (history). Those caps closed a real foot-gun, but they're a defensive band-aid: the active list silently truncates past 500 items with no UI signal, and history fetches up to 500 items per page-load *before* slicing in JS. A separate finding (G in the audit) documented that the history cursor uses only `archivedAt` and can skip items at the same millisecond as a previous page's last entry — a real correctness bug at the trip-archive boundary.

This spec replaces the silent caps with proper cursor-based pagination on both lists and fixes the same-millisecond skip via a compound `(archivedAt, _id)` cursor on history and a `(isBought, createdAt, _id)` cursor on the active list. Frontend gains a "Load more" affordance on the active list (mirroring the existing history pattern). The "Done shopping" workflow gets a dedicated unfiltered bought-items query so the counter and dialog are accurate regardless of pagination state.

No API contract breakage outside the additive cursor/limit query params and the response-shape change for `listItems` (which only impacts internal callers in this codebase).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Pagination type | Cursor-based on both lists; no skip/page-number pagination |
| Active list cursor format | `<0\|1>\|<createdAtIso>\|<itemHexId>` (opaque to frontend) |
| History cursor format | `<archivedAtIso>\|<itemHexId>` (opaque to frontend) |
| Active list page size | Default 50, max 100, min 1 |
| History page size | Default 10, max 50, min 1 (unchanged) |
| Active list UX | "Load more" button at bottom (matches existing history pattern) |
| Cursor tiebreaker (history) | `_id` (descending, since sort is desc by `archivedAt` then desc by `_id`) |
| Cursor tiebreaker (active) | `_id` (descending, after `isBought` asc and `createdAt` desc) |
| Internal fetch ceiling on history | Keep `.limit(500)` as a guard against a single trip with >500 items (rare/impossible in practice) |
| Internal fetch ceiling on active | None — `.limit(pageSize + 1)` is exact (used to detect `hasMore`) |
| Bought-items source for "Done shopping" | New dedicated `useBoughtShoppingItems` hook fetching `?boughtState=bought&limit=500` as a single page |
| Removal of `.limit(500)` on `listItems` | Yes — replaced by cursor-driven `.limit(limit + 1)` |
| Cursor parse failure | Service returns 400 via existing `BadRequestError` |
| Frontend infinite query for active list | TanStack `useInfiniteQuery`, mirroring the existing `useArchivedHistory` shape |
| Optimistic toggle behavior | Update via `setQueriesData` prefix match across all paged caches; same pattern as the v3 fix, adapted for paged shape |

## Verified findings closed by this spec

- **Audit finding G** — same-millisecond cursor skip on history. Resolved by `_id` tiebreaker.
- **Active-list silent truncation past 500** — Resolved by proper cursor pagination.
- **Active list lacks any pagination affordance** — Resolved by "Load more" UX.

## Architecture

```
                                   ┌─────────────────────────────────┐
                                   │   ShoppingListPage              │
                                   │  ┌──────────────────────────┐   │
                                   │  │ useShoppingList()        │   │  paged active list
                                   │  │   → useInfiniteQuery     │   │  filter-aware key
                                   │  └──────────┬───────────────┘   │
                                   │             │ flattens pages    │
                                   │  ┌──────────▼───────────────┐   │
                                   │  │ ShoppingListView         │   │
                                   │  │  + "Load more" button    │   │
                                   │  └──────────────────────────┘   │
                                   │                                 │
                                   │  ┌──────────────────────────┐   │
                                   │  │ useBoughtShoppingItems() │───┼─→ used by:
                                   │  │   → useQuery, no cursor  │   │   1. "Done shopping (N)" badge
                                   │  └──────────────────────────┘   │   2. DoneShoppingDialog item list
                                   │                                 │
                                   │  ┌──────────────────────────┐   │
                                   │  │ useArchivedHistory()     │   │  paged history
                                   │  │   → useInfiniteQuery     │   │  filter-aware key (unchanged)
                                   │  └──────────────────────────┘   │
                                   └─────────────────────────────────┘

Backend service:
  listItems         → cursor (isBought, createdAt, _id), page size 50, returns { items, nextCursor }
  listArchivedHistory → cursor (archivedAt, _id), page size 10, returns { entries, nextCursor }
```

## Backend design

### Cursor format (opaque to consumers)

A pure-string cursor minimizes serialization concerns over the network. The service exposes a `parseCursor` / `encodeCursor` helper internally; outside the service, cursors are treated as opaque. Format choices:

- Active list: `<isBought01>|<createdAtIso>|<itemHexId>`. Example: `1|2026-04-01T12:34:56.789Z|6611abe...`
- History: `<archivedAtIso>|<itemHexId>`. Example: `2026-04-15T08:00:00.000Z|6611abe...`

Cursors include only sort-key fields. Filters (search, categories, boughtState) are *not* encoded — they're sent as separate query params and the consumer is expected to keep them stable across pagination calls (TanStack queryKey already enforces this — when filter changes, queryKey changes, infinite query resets).

### Cursor parse failure handling

Malformed cursor (wrong segment count, invalid ISO, invalid ObjectId) → service throws `BadRequestError('Invalid cursor')`. Validator-level check: cursor is a non-empty string, max length 100. Deeper validation lives in the service since the format is internal.

### `listItems` (active list)

```ts
async listItems(
  householdId: string,
  userId: string,
  options: IListItemsOptions = {}
): Promise<{ items: IShoppingListItemResponse[]; nextCursor: string | null }> {
  const { household } = await getHouseholdForMember(householdId, userId);

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const archivedFilter = options.archived ? { archivedAt: { $ne: null } } : { archivedAt: null };

  const query: Record<string, unknown> = {
    householdId: household._id,
    ...archivedFilter,
  };

  // ... existing search/categories/boughtState filter logic unchanged ...

  if (options.cursor) {
    const c = parseActiveCursor(options.cursor);
    query.$or = [
      { isBought: { $gt: c.isBought } },
      { isBought: c.isBought, createdAt: { $lt: c.createdAt } },
      { isBought: c.isBought, createdAt: c.createdAt, _id: { $lt: c.itemId } },
    ];
  }

  const items = await ShoppingListItem.find(query)
    .sort({ isBought: 1, createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  const pageItems = items.slice(0, limit);
  // ... existing memberMap + format logic ...

  let nextCursor: string | null = null;
  if (hasMore && pageItems.length > 0) {
    const last = pageItems[pageItems.length - 1];
    nextCursor = encodeActiveCursor({
      isBought: last.isBought ? 1 : 0,
      createdAt: last.createdAt.toISOString(),
      itemId: last._id.toString(),
    });
  }

  return { items: formatted, nextCursor };
}
```

Notes:
- The `$or` clause is the standard "stable cursor" pagination pattern. It maps the three sort fields exactly:
  1. `isBought > c.isBought` — strictly past the boundary on the primary sort key
  2. `isBought = c.isBought AND createdAt < c.createdAt` — same isBought slice, advanced on secondary
  3. `isBought = c.isBought AND createdAt = c.createdAt AND _id < c.itemId` — tiebreaker on tertiary
- Sort direction in MongoDB matches: `isBought: 1` (asc — false then true), `createdAt: -1` (desc — newest first within each isBought slice), `_id: -1` (desc — stable tiebreaker).
- Existing index `{ householdId: 1, isBought: 1, createdAt: -1 }` (line 49 of `shopping-list-item.model.ts`) covers the leading sort `{ isBought: 1, createdAt: -1 }`. The explicit `_id: -1` tiebreaker is added for cursor determinism, not for index alignment — MongoDB's implicit `_id` is ascending, so our `-1` direction makes the trailing tiebreaker an in-memory sort step. With page size 50, this is bounded and negligible. If profiling later shows the in-memory step is hot, an additional index `{ householdId: 1, isBought: 1, createdAt: -1, _id: -1 }` would push the full sort into the index. Out of scope here.
- Filters (search regex, categories, boughtState) compose naturally with the cursor `$or`. MongoDB applies all top-level conditions as AND.

### `listArchivedHistory`

```ts
async listArchivedHistory(
  householdId: string,
  userId: string,
  options: IListHistoryOptions = {}
): Promise<IListHistoryResult> {
  const { household } = await getHouseholdForMember(householdId, userId);
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);

  const archivedFilter: Record<string, unknown> = {
    householdId: household._id,
    archivedAt: { $ne: null },
  };

  if (options.cursor) {
    const c = parseHistoryCursor(options.cursor);
    archivedFilter.$or = [
      { archivedAt: { $lt: c.archivedAt } },
      { archivedAt: c.archivedAt, _id: { $lt: c.itemId } },
    ];
    // The cursor's $or already enforces archivedAt is set; remove the redundant $ne: null
    delete archivedFilter.archivedAt;
  }

  // ... existing search + categories filter logic ...

  const items = await ShoppingListItem.find(archivedFilter)
    .sort({ archivedAt: -1, _id: -1 })
    .limit(500) // safety ceiling for pathological single-trip data; keeps behavior bounded
    .lean();

  // ... existing memberMap + trip-grouping into entries[] ...

  // Build cursor from the LAST included entry's last item (which has smallest _id since sort desc).
  const pageEntries = entries.slice(0, limit);
  const hasMore = entries.length > limit || items.length === 500;

  let nextCursor: string | null = null;
  if (hasMore && pageEntries.length > 0) {
    const lastEntry = pageEntries[pageEntries.length - 1];
    const lastItem = lastEntry.items[lastEntry.items.length - 1];
    nextCursor = encodeHistoryCursor({
      archivedAt: lastEntry.archivedAt,
      itemId: lastItem._id,
    });
  }

  return { entries: pageEntries, nextCursor };
}
```

Notes:
- The cursor `$or` is the same compound-cursor pattern as the active list, with two branches because the sort has two keys.
- `_id: -1` tiebreaker resolves the same-millisecond bug. With sort desc and `_id < c.itemId`, the next page picks up items at the same `archivedAt` with smaller `_id` than the cursor's.
- Trip-grouping logic stays as-is. Items in a single trip share `archivedAt`; sorted within the trip by `_id: -1`. The "last item of the entry" (smallest `_id` due to desc sort) becomes the cursor anchor.
- Existing index `{ householdId: 1, archivedAt: -1 }` (line 51 of `shopping-list-item.model.ts`) covers the primary sort. `_id: -1` tiebreaker is in-memory; bounded by `.limit(500)` and small in practice. Same perf note as the active list — additional `{ householdId: 1, archivedAt: -1, _id: -1 }` index could be added later if profiling shows it's needed.
- Internal `.limit(500)` retained as a guard. Couples doing a single shopping trip with >500 items is impossibly rare; this just bounds the worst case so a single page-load is bounded in time/memory.
- `hasMore` triggers from either `entries.length > limit` (typical case — we got more entries than requested) OR `items.length === 500` (defensive case — we hit the fetch ceiling).

### Cursor helpers (private to service)

```ts
function encodeActiveCursor(c: { isBought: 0 | 1; createdAt: string; itemId: string }): string {
  return `${c.isBought}|${c.createdAt}|${c.itemId}`;
}

function parseActiveCursor(raw: string): { isBought: boolean; createdAt: Date; itemId: Types.ObjectId } {
  const parts = raw.split('|');
  if (parts.length !== 3) throw BadRequestError('Invalid cursor');
  const [boughtStr, createdAtStr, itemIdStr] = parts;
  if (boughtStr !== '0' && boughtStr !== '1') throw BadRequestError('Invalid cursor');
  const createdAt = new Date(createdAtStr);
  if (Number.isNaN(createdAt.getTime())) throw BadRequestError('Invalid cursor');
  if (!Types.ObjectId.isValid(itemIdStr)) throw BadRequestError('Invalid cursor');
  return { isBought: boughtStr === '1', createdAt, itemId: new Types.ObjectId(itemIdStr) };
}

function encodeHistoryCursor(c: { archivedAt: string; itemId: string }): string {
  return `${c.archivedAt}|${c.itemId}`;
}

function parseHistoryCursor(raw: string): { archivedAt: Date; itemId: Types.ObjectId } {
  const parts = raw.split('|');
  if (parts.length !== 2) throw BadRequestError('Invalid cursor');
  const [archivedAtStr, itemIdStr] = parts;
  const archivedAt = new Date(archivedAtStr);
  if (Number.isNaN(archivedAt.getTime())) throw BadRequestError('Invalid cursor');
  if (!Types.ObjectId.isValid(itemIdStr)) throw BadRequestError('Invalid cursor');
  return { archivedAt, itemId: new Types.ObjectId(itemIdStr) };
}
```

These can live as module-level helpers in `shopping-list.service.ts` (private to the file). No need for a new util file unless they're reused elsewhere.

### Backend types

`BackEnd/src/types/shopping-list.types.ts`:

```ts
export interface IListItemsOptions {
  archived?: boolean;
  search?: string;
  categories?: string[];
  boughtState?: BoughtState;
  cursor?: string;
  limit?: number;
}

export interface IListItemsResult {
  items: IShoppingListItemResponse[];
  nextCursor: string | null;
}

// IListHistoryOptions already has cursor/limit — no change
// IListHistoryResult shape unchanged (already { entries, nextCursor })
```

Update `listItems` return type to `Promise<IListItemsResult>`.

### Backend validator

`BackEnd/src/validators/shopping-list.validator.ts` — add to `householdIdOnlyValidation`:

```ts
query('cursor')
  .optional()
  .isString()
  .withMessage('cursor must be a string')
  .isLength({ max: 100 })
  .withMessage('cursor cannot exceed 100 characters'),

query('limit')
  .optional()
  .isInt({ min: 1, max: 100 })
  .withMessage('limit must be between 1 and 100')
  .toInt(),
```

History validator (`historyValidation`) already validates cursor as ISO8601 — that needs updating since cursor is no longer a pure ISO date:

```ts
query('cursor')
  .optional()
  .isString()
  .withMessage('cursor must be a string')
  .isLength({ max: 100 })
  .withMessage('cursor cannot exceed 100 characters'),
```

Limit validator on history stays.

### Backend controller

`BackEnd/src/controllers/shopping-list.controller.ts`:

`listItems` — read cursor and limit from query, pass to service:

```ts
const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
const limit = typeof req.query.limit === 'number' ? req.query.limit : undefined;
const { search, categories, boughtState } = this.parseFilterQuery(req);
const result = await shoppingListService.listItems(householdId, req.user.userId, {
  archived,
  search,
  categories,
  boughtState,
  cursor,
  limit,
});
```

`listArchivedHistory` — already passes cursor/limit; no change required.

## Frontend design

### Types

`FrontEnd/src/types/shoppingList.types.ts`:

```ts
export interface ShoppingListPage {
  items: ShoppingListItemResponse[];
  nextCursor: string | null;
}

// Existing ShoppingListResult (used by api.ts) becomes ShoppingListPage
// Existing HistoryPage shape unchanged
```

### API

`FrontEnd/src/api/shoppingList.api.ts`:

```ts
export interface ListItemsParams {
  search?: string;
  categories?: string[];
  boughtState?: BoughtState;
  cursor?: string;
  limit?: number;
  archived?: boolean;
}

async listItems(householdId: string, params: ListItemsParams = {}): Promise<ShoppingListPage> { ... }
```

Existing `paramsSerializer: { indexes: null }` handles the `categories` array correctly. Cursor and limit are scalars.

### Hooks

`FrontEnd/src/hooks/queries/useShoppingListQueries.ts`:

**`useShoppingList`** — switch from `useQuery` to `useInfiniteQuery`:

```ts
export function useShoppingList(householdId: string, filter?: ShoppingListFilter) {
  const params = filter ? { /* same as today */ } : undefined;
  const PAGE_SIZE = 50;

  return useInfiniteQuery({
    queryKey: queryKeys.shoppingList.list(householdId, {
      search: params?.search,
      categories: params?.categories,
      boughtState: params?.boughtState,
    }),
    queryFn: ({ pageParam }) =>
      shoppingListApi.listItems(householdId, {
        ...params,
        cursor: pageParam as string | undefined,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
```

**New `useBoughtShoppingItems(householdId)`** — single-page query for the "Done shopping" flow:

```ts
export function useBoughtShoppingItems(householdId: string) {
  return useQuery({
    queryKey: queryKeys.shoppingList.bought(householdId),
    queryFn: () =>
      shoppingListApi.listItems(householdId, { boughtState: 'bought', limit: 500 }),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    select: (page) => page.items, // unwrap to flat items array
  });
}
```

`queryKeys.shoppingList.bought(householdId)` — add to `queryKeys.ts`:

```ts
bought: (householdId: string) => ['shoppingList', householdId, 'bought'] as const,
```

**`useToggleShoppingItemBought`** — adapt for paginated shape. The existing logic uses `setQueriesData<ShoppingListResult>` with prefix `['shoppingList', householdId, 'list']`. With infinite query, the cache shape is `InfiniteData<ShoppingListPage>` (pages array). Update:

```ts
queryClient.setQueriesData<InfiniteData<ShoppingListPage>>(
  { queryKey: listPrefix },
  (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((i) =>
              i._id === itemId ? { ...i, isBought: !i.isBought } : i
            ),
          })),
        }
      : old
);
```

Snapshots type changes accordingly. Also: invalidate `queryKeys.shoppingList.bought(householdId)` on settle, since toggling bought changes that count too.

**Other mutations** (`useAddShoppingItem`, `useUpdateShoppingItem`, `useArchiveShoppingItem`, `useRestoreShoppingItem`, `useDeleteShoppingItem`, `useArchiveBoughtShoppingItems`) — already invalidate `queryKeys.shoppingList.all(householdId)` which is a prefix of all sub-keys including `bought`. No change needed.

### UI

**`FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx`** — accept paginated data. Either:
- Receive `pages` directly and flatten internally, exposing a "Load more" button at bottom
- Receive a flattened `items: ShoppingListItemResponse[]` plus `hasNextPage` and `fetchNextPage` props

Approach 2 is cleaner — keeps the view simpler and the page handles the infinite-query mechanics. Add two new props: `hasNextPage: boolean`, `onLoadMore: () => void`, `isFetchingNextPage: boolean`.

`ShoppingListView` renders:
- The existing item list
- A "Load more" button at the bottom, shown when `hasNextPage`, disabled when `isFetchingNextPage`, label "Load more" / "Loading…"

**`FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`** — wire up the new hooks:

```ts
const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useShoppingList(householdId, filter);
const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? EMPTY_ITEMS, [data]);

const { data: boughtItems = [] } = useBoughtShoppingItems(householdId);
const hasBought = boughtItems.length > 0;
const dominantCategory = useMemo(() => computeDominantCategory(boughtItems), [boughtItems]);

// "Done shopping (N)" badge uses boughtItems.length
// DoneShoppingDialog gets boughtItems via prop (unchanged shape)
// ShoppingListView gets items, hasNextPage, fetchNextPage, isFetchingNextPage
```

The "leave guard" effect (`setShoppingListBoughtCount(boughtItems.length)`) — already pulls from boughtItems, so it correctly reflects the unfiltered count via the new hook.

**`DoneShoppingDialog.tsx`** — no internal change. Still receives `boughtItems` as a prop, just from the new source.

**`ShoppingHistoryView`** — already uses the existing infinite query for history. The cursor format change is opaque to it. No change needed assuming the hook handles cursor passing through.

## Critical files to modify

**Backend:**
- `BackEnd/src/types/shopping-list.types.ts` — extend options + result types
- `BackEnd/src/validators/shopping-list.validator.ts` — add cursor/limit validators on `householdIdOnlyValidation`; relax cursor validator on `historyValidation` (no longer ISO8601)
- `BackEnd/src/controllers/shopping-list.controller.ts` — read cursor/limit from query in `listItems`
- `BackEnd/src/services/shopping-list.service.ts` — rewrite `listItems` and `listArchivedHistory` cursor logic; add private cursor helpers

**Frontend:**
- `FrontEnd/src/types/shoppingList.types.ts` — `ShoppingListPage` type, extended `ListItemsParams`
- `FrontEnd/src/api/shoppingList.api.ts` — new return type
- `FrontEnd/src/lib/queryKeys.ts` — add `bought` key
- `FrontEnd/src/hooks/queries/useShoppingListQueries.ts` — `useShoppingList` → infinite query; new `useBoughtShoppingItems`; adapt `useToggleShoppingItemBought` snapshot+update logic
- `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx` — add Load-more button; props change
- `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx` — wire new hooks; flatten pages; pass new props to view

No new files. No model schema changes. No frontend route changes. Existing index `{ householdId: 1, isBought: 1, createdAt: -1 }` covers the active-list cursor query (`_id` is implicit). Existing index `{ householdId: 1, archivedAt: -1 }` covers history (also with implicit `_id`).

## Reused functions / utilities

- `getHouseholdForMember` — `BackEnd/src/utils/household.helpers.ts`
- `escapeRegex` — `BackEnd/src/utils/regex.ts`
- `BadRequestError`, `NotFoundError` — `BackEnd/src/utils/error.ts`
- `Types` (Mongoose) — `mongoose`
- TanStack `useInfiniteQuery`, `useQuery`, `useMutation` — `@tanstack/react-query`
- `setQueriesData` prefix-match pattern — already in use for the optimistic toggle
- shadcn `<Button>` — for the Load-more affordance

## Verification

**Static:**
- `cd BackEnd && npx tsc --noEmit` — clean
- `cd FrontEnd && npx tsc --noEmit && npm run build` — clean

**Backend smoke (manual, on dev DB):**
- Insert >100 active items in one household. Call `GET /shopping-list?limit=50` with no cursor → 50 items + nextCursor. Pass cursor → next 50, etc.
- Insert items spanning isBought boundary; verify pagination order matches `{ isBought: 1, createdAt: -1, _id: -1 }`.
- Archive a "Done shopping" trip with 5 items at one millisecond, then immediately archive a manual item at the same millisecond. Page through history with `limit=2` — verify the manual entry is included on a subsequent page, not lost.
- Send a malformed cursor (`?cursor=garbage`) → 400 from validator (length OK) or service (parse fail).
- Send `?cursor=...&limit=200` → 400 from validator (limit > 100).

**Frontend smoke (manual, in browser):**
- Active list with >50 items: scroll to bottom, click "Load more" → next page appends, button updates `hasNextPage`.
- Filter (search/category) re-fires from page 1 — pagination resets cleanly.
- Toggle bought on an item across page 2 — optimistic update reflects, "Done shopping (N)" updates from `useBoughtShoppingItems` (separate query).
- "Done shopping" → DoneShoppingDialog shows all bought items, regardless of currently visible page.
- History tab: Load more works, cursor advances correctly.

**End-to-end:**
- Same-millisecond test: trigger `archiveBought` on N items, then immediately archive a manual item. Verify the manual entry appears on the correct history page (not skipped).

## Out of scope (explicitly)

- Skip/page-number pagination (`?page=N&pageSize=M`) — cursor is strictly correct for active-write data and avoids skip-drift bugs
- Total-count display ("X of Y") — would need an extra `countDocuments` per page; not requested
- Pagination on the recurring-rules tab — bounded set per household, not worth the complexity
- Pagination of the bought-items query (`useBoughtShoppingItems`) — bounded set in practice (one shopping trip's worth)
- Server-side filter for "show only my added items" — not in current spec
- Compound index `{ householdId: 1, isBought: 1, createdAt: -1, _id: -1 }` — `_id` is implicit in MongoDB indexes; no new index needed
- Migrating away from `boughtState` filter altogether — scope creep
- Changing the trip-grouping logic in history — kept identical externally
- Frontend URL-syncing of cursor — pagination state is session-local, matches existing history pattern
