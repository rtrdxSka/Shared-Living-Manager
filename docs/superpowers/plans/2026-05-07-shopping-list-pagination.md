# Shopping List Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit policy:** The user is handling all commits manually. Implementer subagents must NOT run `git add` / `git commit`. Each task ends with verification + a reported DONE; the user commits between tasks (or in batches) at their own pace.

**Goal:** Replace silent `.limit(500)` truncation on the active shopping list with proper cursor pagination, fix the same-millisecond skip bug on history pagination via a `_id` tiebreaker, and surface a "Load more" affordance on both lists.

**Architecture:** Cursor-based pagination on both lists. Active list cursor = `(isBought, createdAt, _id)`; history cursor = `(archivedAt, _id)`. Frontend uses TanStack `useInfiniteQuery` for both. A separate single-page `useBoughtShoppingItems` hook supplies the "Done shopping" counter and dialog so the count remains accurate regardless of pagination state.

**Tech Stack:** Node.js + Express + TypeScript + Mongoose; React + TypeScript + TanStack Query + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-05-07-shopping-list-pagination-design.md`

**Verification policy:** No Jest infrastructure exists in this repo. Per-task verification is `tsc --noEmit` clean. End-to-end smoke is a final manual task with a checklist.

---

## File Structure

**Backend:**
- `BackEnd/src/types/shopping-list.types.ts` — extended options + new result type
- `BackEnd/src/validators/shopping-list.validator.ts` — cursor + limit on `householdIdOnlyValidation`; relaxed cursor on `historyValidation`
- `BackEnd/src/controllers/shopping-list.controller.ts` — read cursor/limit on `listItems`
- `BackEnd/src/services/shopping-list.service.ts` — private cursor helpers; rewrite both list methods

**Frontend:**
- `FrontEnd/src/types/shoppingList.types.ts` — `ShoppingListPage` type, extended `ListItemsParams`
- `FrontEnd/src/api/shoppingList.api.ts` — accept cursor/limit on `listItems`
- `FrontEnd/src/lib/queryKeys.ts` — add `bought` key
- `FrontEnd/src/hooks/queries/useShoppingListQueries.ts` — `useShoppingList` → infinite query; new `useBoughtShoppingItems`; adapt optimistic toggle
- `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx` — Load-more button + new props
- `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx` — wire new hooks, flatten pages, pass new props

No new files. No model schema changes.

---

## Task 1: Backend types — extend `IListItemsOptions` and add `IListItemsResult`

**Files:**
- Modify: `BackEnd/src/types/shopping-list.types.ts`

- [ ] **Step 1: Read the current shape**

Run: `grep -n "IListItemsOptions\|IListItemsResult\|listItems" BackEnd/src/types/shopping-list.types.ts`
Read the file to understand current option/result interfaces (in particular `IListItemsOptions`).

- [ ] **Step 2: Extend `IListItemsOptions` with `cursor` and `limit`**

Locate the existing `IListItemsOptions` interface. Add the two new optional fields. Final shape:

```ts
export interface IListItemsOptions {
  archived?: boolean;
  search?: string;
  categories?: string[];
  boughtState?: BoughtState;
  cursor?: string;
  limit?: number;
}
```

If the interface already has `archived`/`search`/`categories`/`boughtState`, only ADD the two new lines. Do not reorder.

- [ ] **Step 3: Add `IListItemsResult` interface**

Add immediately after `IListItemsOptions`:

```ts
export interface IListItemsResult {
  items: IShoppingListItemResponse[];
  nextCursor: string | null;
}
```

If the file uses a different naming convention, follow it (e.g., if there's already an existing `IListItemsResult`, extend it instead).

- [ ] **Step 4: Verify tsc clean**

Run: `cd BackEnd && npx tsc --noEmit`
Expected: zero output. (Note: the service still returns `{ items }` until Task 4 — but only the types are added here, no consumer is yet asking for `nextCursor`, so tsc stays clean.)

- [ ] **Step 5: Report DONE**

Implementer reports DONE. User will commit when ready. Do NOT run `git add` / `git commit`.

---

## Task 2: Backend validators — cursor + limit on active list; relax history cursor

**Files:**
- Modify: `BackEnd/src/validators/shopping-list.validator.ts`

- [ ] **Step 1: Read the current validators**

Read `BackEnd/src/validators/shopping-list.validator.ts`. Locate:
- `householdIdOnlyValidation` — validators for the active list query
- `historyValidation` — validators for the history query (currently has `query('cursor').optional().isISO8601()`)

- [ ] **Step 2: Add cursor + limit to `householdIdOnlyValidation`**

Append at the end of the array, after the existing `archived` chain:

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

- [ ] **Step 3: Relax cursor in `historyValidation`**

Find the existing `query('cursor').optional().isISO8601()...` block in `historyValidation`. Replace with the same generic-string validator:

```ts
query('cursor')
  .optional()
  .isString()
  .withMessage('cursor must be a string')
  .isLength({ max: 100 })
  .withMessage('cursor cannot exceed 100 characters'),
```

Leave the existing `limit` validator alone — history's max remains 50.

- [ ] **Step 4: Verify tsc clean**

Run: `cd BackEnd && npx tsc --noEmit`
Expected: zero output.

- [ ] **Step 5: Report DONE**

Do NOT commit.

---

## Task 3: Backend controller — pass cursor + limit through

**Files:**
- Modify: `BackEnd/src/controllers/shopping-list.controller.ts`

- [ ] **Step 1: Read `listItems` controller method**

Run: `grep -nB2 -A20 "async listItems" BackEnd/src/controllers/shopping-list.controller.ts`

The method currently parses `archived` and uses `parseFilterQuery(req)` for search/categories/boughtState.

- [ ] **Step 2: Read cursor and limit from query**

Inside the `listItems` method, after `const { search, categories, boughtState } = this.parseFilterQuery(req);`, add:

```ts
const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
const limit = typeof req.query.limit === 'number' ? req.query.limit : undefined;
```

The validator runs `.toInt()` on `limit`, so it arrives as a real number (or undefined). The cursor is a string (or undefined).

- [ ] **Step 3: Pass them to the service**

Update the existing `shoppingListService.listItems(...)` call to include the new fields:

```ts
const result = await shoppingListService.listItems(householdId, req.user.userId, {
  archived,
  search,
  categories,
  boughtState,
  cursor,
  limit,
});
```

`listArchivedHistory` controller method already passes `cursor` and `limit` through — leave it alone.

- [ ] **Step 4: Verify tsc clean**

Run: `cd BackEnd && npx tsc --noEmit`
Expected: zero output. (The service signature accepts `cursor`/`limit` because Task 1 added them to `IListItemsOptions`.)

- [ ] **Step 5: Report DONE**

Do NOT commit.

---

## Task 4: Backend service — `listItems` cursor pagination

**Files:**
- Modify: `BackEnd/src/services/shopping-list.service.ts`

This task adds private cursor helpers at the top of the file and rewrites the `listItems` method to support cursor-based pagination.

- [ ] **Step 1: Add private cursor helpers**

After the imports and before the `class ShoppingListService` declaration, add module-private helper functions:

```ts
function encodeActiveCursor(c: { isBought: boolean; createdAt: Date; itemId: Types.ObjectId }): string {
  return `${c.isBought ? 1 : 0}|${c.createdAt.toISOString()}|${c.itemId.toString()}`;
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
```

`Types` is already imported from `mongoose` at the top of the file. `BadRequestError` is already imported from `'../utils/error'`.

- [ ] **Step 2: Rewrite `listItems`**

Locate the existing `listItems` method. Replace its body with:

```ts
async listItems(
  householdId: string,
  userId: string,
  options: IListItemsOptions = {}
): Promise<IListItemsResult> {
  const { household } = await getHouseholdForMember(householdId, userId);

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const archivedFilter = options.archived
    ? { archivedAt: { $ne: null } }
    : { archivedAt: null };

  const query: Record<string, unknown> = {
    householdId: household._id,
    ...archivedFilter,
  };

  if (options.search && options.search.trim().length > 0) {
    query.name = { $regex: escapeRegex(options.search.trim()), $options: 'i' };
  }

  if (options.categories && options.categories.length > 0) {
    query.category = { $in: options.categories };
  }

  if (options.boughtState === 'bought') {
    query.isBought = true;
  } else if (options.boughtState === 'unbought') {
    query.isBought = false;
  }

  if (options.cursor) {
    const c = parseActiveCursor(options.cursor);
    const cursorBranches: Record<string, unknown>[] = [
      { isBought: { $gt: c.isBought } },
      { isBought: c.isBought, createdAt: { $lt: c.createdAt } },
      { isBought: c.isBought, createdAt: c.createdAt, _id: { $lt: c.itemId } },
    ];
    // If a boughtState filter narrows to a specific isBought value, drop branches that contradict it.
    if (query.isBought !== undefined) {
      query.$or = cursorBranches.filter((b) => {
        if (typeof b.isBought === 'boolean') return b.isBought === query.isBought;
        return true; // $gt branch is contradictory if isBought is filtered, but Mongo will simply return zero matches — acceptable
      });
    } else {
      query.$or = cursorBranches;
    }
  }

  const items = await ShoppingListItem.find(query)
    .sort({ isBought: 1, createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  const pageItems = items.slice(0, limit);

  const memberMap = new Map<string, string>();
  for (const m of household.members) {
    memberMap.set(m._id.toString(), m.nickname);
  }

  const formatted = pageItems.map((item) => {
    const boughtByMemberId = item.boughtByMemberId?.toString();
    const boughtByNickname = boughtByMemberId
      ? memberMap.get(boughtByMemberId)
      : undefined;
    return this.formatLeanResponse(item, boughtByNickname);
  });

  let nextCursor: string | null = null;
  if (hasMore && pageItems.length > 0) {
    const last = pageItems[pageItems.length - 1];
    nextCursor = encodeActiveCursor({
      isBought: last.isBought,
      createdAt: last.createdAt,
      itemId: last._id,
    });
  }

  return { items: formatted, nextCursor };
}
```

Note: the `.limit(500)` previously on this method is removed and replaced by `.limit(limit + 1)`.

- [ ] **Step 3: Update return type import if needed**

Verify the file imports `IListItemsResult` from `../types/shopping-list.types` (added in Task 1). Add it to the existing import if missing.

- [ ] **Step 4: Verify tsc clean**

Run: `cd BackEnd && npx tsc --noEmit`
Expected: zero output.

- [ ] **Step 5: Quick sanity grep**

Run: `grep -n "limit(500)" BackEnd/src/services/shopping-list.service.ts`
Expected: ONE remaining match — the `.limit(500)` on `listArchivedHistory` (the active list's cap is now removed; history's cap stays as a safety guard until Task 5 keeps it intentionally).

- [ ] **Step 6: Report DONE**

Do NOT commit.

---

## Task 5: Backend service — `listArchivedHistory` cursor with `_id` tiebreaker

**Files:**
- Modify: `BackEnd/src/services/shopping-list.service.ts`

This task adds the second pair of cursor helpers and rewrites the `listArchivedHistory` cursor logic to use a compound `(archivedAt, _id)` cursor.

- [ ] **Step 1: Add history cursor helpers**

Below the active cursor helpers added in Task 4 (still above the class declaration), add:

```ts
function encodeHistoryCursor(c: { archivedAt: Date; itemId: Types.ObjectId }): string {
  return `${c.archivedAt.toISOString()}|${c.itemId.toString()}`;
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

- [ ] **Step 2: Rewrite the cursor block in `listArchivedHistory`**

Locate the existing block:

```ts
const archivedFilter: Record<string, unknown> = {
  householdId: household._id,
  archivedAt: { $ne: null },
};
if (options.cursor) {
  archivedFilter.archivedAt = { $ne: null, $lt: new Date(options.cursor) };
}
```

Replace with:

```ts
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
  // The $or already enforces archivedAt is set to a date < or = cursor.archivedAt; remove the redundant $ne: null
  delete archivedFilter.archivedAt;
}
```

- [ ] **Step 3: Update sort to include `_id: -1` tiebreaker**

In the same method, change:

```ts
const items = await ShoppingListItem.find(archivedFilter)
  .sort({ archivedAt: -1 })
  .limit(500)
  .lean();
```

To:

```ts
const items = await ShoppingListItem.find(archivedFilter)
  .sort({ archivedAt: -1, _id: -1 })
  .limit(500)
  .lean();
```

The `.limit(500)` stays as an internal safety ceiling against a single trip with absurdly many items.

- [ ] **Step 4: Update `nextCursor` construction**

Locate the existing block at the end of the method:

```ts
const pageEntries = entries.slice(0, limit);
const hasMore = entries.length > limit;
const nextCursor = hasMore ? pageEntries[pageEntries.length - 1].archivedAt : null;

return { entries: pageEntries, nextCursor };
```

Replace with:

```ts
const pageEntries = entries.slice(0, limit);
const hasMore = entries.length > limit || items.length === 500;

let nextCursor: string | null = null;
if (hasMore && pageEntries.length > 0) {
  const lastEntry = pageEntries[pageEntries.length - 1];
  const lastFormattedItem = lastEntry.items[lastEntry.items.length - 1];
  nextCursor = encodeHistoryCursor({
    archivedAt: new Date(lastEntry.archivedAt),
    itemId: new Types.ObjectId(lastFormattedItem._id),
  });
}

return { entries: pageEntries, nextCursor };
```

The "last item of the last entry" has the smallest `_id` in its trip because the items were sorted desc within the trip. That's the correct anchor point for next-page advance.

- [ ] **Step 5: Verify tsc clean**

Run: `cd BackEnd && npx tsc --noEmit`
Expected: zero output.

- [ ] **Step 6: Sanity check the diff**

Run: `git diff BackEnd/src/services/shopping-list.service.ts | grep -E "^\+|^-" | head -120`
Verify:
- Active list `.limit(500)` is removed (replaced by `.limit(limit + 1)`)
- History `.limit(500)` is retained
- Both methods now have `_id: -1` in the sort
- New cursor helpers are present at file top
- Old `archivedAt: ISO` cursor format is replaced with compound parsing

- [ ] **Step 7: Report DONE**

Do NOT commit.

---

## Task 6: Frontend types + API + queryKeys

**Files:**
- Modify: `FrontEnd/src/types/shoppingList.types.ts`
- Modify: `FrontEnd/src/api/shoppingList.api.ts`
- Modify: `FrontEnd/src/lib/queryKeys.ts`

- [ ] **Step 1: Update `ShoppingListPage` (or equivalent) type**

In `FrontEnd/src/types/shoppingList.types.ts`, add a new type for the paged active list response:

```ts
export interface ShoppingListPage {
  items: ShoppingListItemResponse[];
  nextCursor: string | null;
}
```

If a `ShoppingListResult` type already exists in this file or in `shoppingList.api.ts` and is exported as `{ items: ShoppingListItemResponse[] }`, replace its definition with `ShoppingListPage`'s shape (i.e. add `nextCursor: string | null`). The two should have the same shape after this change.

- [ ] **Step 2: Extend `ListItemsParams`**

In `FrontEnd/src/api/shoppingList.api.ts`, locate `ListItemsParams`. Extend with `cursor` and `limit`:

```ts
export interface ListItemsParams {
  search?: string;
  categories?: string[];
  boughtState?: BoughtState;
  cursor?: string;
  limit?: number;
}
```

(Note: the existing `archived` field — if present in this interface — stays. If absent, do NOT add it; it's controlled by a separate route in this codebase.)

- [ ] **Step 3: Update `shoppingListApi.listItems` return type**

Change the return type of `listItems` from `Promise<ShoppingListResult>` to `Promise<ShoppingListPage>`. The response handler logic stays the same — `data.data` already includes `items` and now also `nextCursor` from the backend (Task 4's service change). Update the export of `ShoppingListResult` to point at `ShoppingListPage` if the file re-exports the result type.

If `ShoppingListResult` is used in many other files, keep the name as an alias: `export type ShoppingListResult = ShoppingListPage;`. This avoids a wide rename in a single task.

- [ ] **Step 4: Add `bought` query key**

In `FrontEnd/src/lib/queryKeys.ts`, locate `queryKeys.shoppingList`. Add a new factory:

```ts
bought: (householdId: string) => ['shoppingList', householdId, 'bought'] as const,
```

Place it after the existing factories (e.g., `list`, `history`, `recurring`).

- [ ] **Step 5: Verify frontend tsc clean**

Run: `cd FrontEnd && npx tsc --noEmit`
Expected: zero output. There WILL be type narrowing complaints in downstream consumers (the hooks file, the page) but ONLY if those files are reached. Since the hooks haven't changed yet, the new `nextCursor` property is just additive and shouldn't break type-checking on the existing consumer (the controller in `useShoppingList` selects `data.items`).

If tsc complains about any consumer expecting the old shape, note the file:line in the report — Task 7 will sort it.

- [ ] **Step 6: Report DONE**

Do NOT commit.

---

## Task 7: Frontend hooks — `useShoppingList` → infinite, new `useBoughtShoppingItems`, adapt toggle

**Files:**
- Modify: `FrontEnd/src/hooks/queries/useShoppingListQueries.ts`

- [ ] **Step 1: Switch `useShoppingList` to `useInfiniteQuery`**

Replace the existing `useShoppingList` hook body. The key changes: queryFn takes `pageParam`, return value is paged.

```ts
const ACTIVE_PAGE_SIZE = 50;

export function useShoppingList(householdId: string, filter?: ShoppingListFilter) {
  const params = filter
    ? {
        search: filter.search.trim() || undefined,
        categories: filter.categories.length > 0 ? filter.categories : undefined,
        boughtState: filter.boughtState !== 'all' ? filter.boughtState : undefined,
      }
    : undefined;

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
        limit: ACTIVE_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ShoppingListPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
```

Add `import { useInfiniteQuery } from '@tanstack/react-query';` if not already present (alongside `useQuery`/`useMutation`/`useQueryClient`). Add `ShoppingListPage` to the imports from `'@/api/shoppingList.api'` (or `'@/types/shoppingList.types'` depending on where you placed it in Task 6).

- [ ] **Step 2: Add `useBoughtShoppingItems` hook**

Add a new hook below `useShoppingList`:

```ts
export function useBoughtShoppingItems(householdId: string) {
  return useQuery({
    queryKey: queryKeys.shoppingList.bought(householdId),
    queryFn: () =>
      shoppingListApi.listItems(householdId, { boughtState: 'bought', limit: 500 }),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    select: (page) => page.items,
  });
}
```

The `select` extracts the items array from the paged response so callers see `data: ShoppingListItemResponse[] | undefined`.

- [ ] **Step 3: Adapt `useToggleShoppingItemBought` for paged shape**

Locate the existing `useToggleShoppingItemBought` hook. The cache it manipulates is now `InfiniteData<ShoppingListPage>` instead of `ShoppingListResult`.

Replace the body of `onMutate` with:

```ts
onMutate: async (itemId) => {
  await queryClient.cancelQueries({ queryKey: listPrefix });
  const snapshots = queryClient.getQueriesData<InfiniteData<ShoppingListPage>>({ queryKey: listPrefix });
  queryClient.setQueriesData<InfiniteData<ShoppingListPage>>({ queryKey: listPrefix }, (old) =>
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
  return { snapshots };
},
```

Update the context type accordingly:

```ts
return useMutation<
  unknown,
  Error,
  string,
  { snapshots: Array<[readonly unknown[], InfiniteData<ShoppingListPage> | undefined]> }
>({ ... });
```

Update `onError` to restore each snapshot (the existing logic works the same since it iterates the snapshots array — verify the type matches).

`onSettled` already invalidates `queryKeys.shoppingList.all(householdId)` which is a prefix of both `list` and `bought` keys — so `useBoughtShoppingItems` re-fetches automatically. No change needed there.

Add `InfiniteData` to the TanStack imports.

- [ ] **Step 4: Verify other mutations still work**

Existing hooks `useAddShoppingItem`, `useUpdateShoppingItem`, `useArchiveShoppingItem`, `useRestoreShoppingItem`, `useDeleteShoppingItem`, `useArchiveBoughtShoppingItems` all invalidate `queryKeys.shoppingList.all(householdId)`. That's a prefix of the new `bought` key, so they'll trigger refetch correctly. No code change needed in those hooks.

- [ ] **Step 5: Verify tsc clean**

Run: `cd FrontEnd && npx tsc --noEmit`
Expected: zero output. Type changes at consumer sites (the page) come in Task 9 — but tsc may flag the page now if the existing consumer destructures `data.items`. If so, mark the offending lines for fix in Task 9 and proceed.

- [ ] **Step 6: Report DONE**

Do NOT commit. Note any TS errors at the page level — those will be addressed in Task 9.

---

## Task 8: Frontend `ShoppingListView` — Load-more button + new props

**Files:**
- Modify: `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx`

- [ ] **Step 1: Read the current view**

Read `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx`. Identify the existing props interface (likely `householdId`, `items`, `onEditItem`).

- [ ] **Step 2: Extend props**

Add three new props to the props interface:

```ts
hasNextPage: boolean;
onLoadMore: () => void;
isFetchingNextPage: boolean;
```

Place them after the existing props.

- [ ] **Step 3: Render the Load-more button**

At the end of the items list (after the existing item rendering), conditionally render:

```tsx
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
```

Import `Button` from `'@/components/ui/button'` if not already imported.

If the view's items render is wrapped in a list element (`<ul>`, `<div>`), the Load-more button goes OUTSIDE the list, after the closing tag, but inside the same parent container so it appears at the visual bottom.

- [ ] **Step 4: Verify tsc clean**

Run: `cd FrontEnd && npx tsc --noEmit`
Expected: tsc errors only on `ShoppingListPage.tsx` (which doesn't yet pass the new props). Those are addressed in Task 9. If errors appear elsewhere, fix them now.

- [ ] **Step 5: Report DONE**

Do NOT commit.

---

## Task 9: Frontend `ShoppingListPage` — wire new hooks, flatten pages, pass new props

**Files:**
- Modify: `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`

- [ ] **Step 1: Read the current page**

Read `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`. Note: it currently uses `useShoppingList` returning `{ data, isLoading }` where `data?.items` is the flat list, and computes `boughtItems = items.filter(i => i.isBought)`.

- [ ] **Step 2: Replace `useShoppingList` consumption with paged shape**

The hook now returns `{ data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage }` where `data?.pages` is an array of `ShoppingListPage`. Change the destructure:

```ts
const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useShoppingList(householdId, filter);
const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? EMPTY_ITEMS, [data]);
```

- [ ] **Step 3: Add the bought-items query**

Import `useBoughtShoppingItems` from the hooks file. Add immediately after `useShoppingList`:

```ts
const { data: boughtItems = [] } = useBoughtShoppingItems(householdId);
```

This replaces the previous `boughtItems = useMemo(() => items.filter((i) => i.isBought), [items]);`. Remove the previous line.

- [ ] **Step 4: Verify the rest of the page wiring is correct**

Confirm:
- `hasBought = boughtItems.length > 0` still works (now sourced from the dedicated query)
- `dominantCategory = useMemo(() => computeDominantCategory(boughtItems), [boughtItems])` works (boughtItems is the same shape)
- `setShoppingListBoughtCount(boughtItems.length)` still uses the new boughtItems
- `useBeforeUnload(boughtItems.length > 0)` still works
- `buildPrefillFromBought(boughtItems)` still works
- `handleConvertConfirm` deps still includes `boughtItems` (or a derivative)
- The "Done shopping (N)" button uses `boughtItems.length`

No logic change should be needed if the page consistently uses `boughtItems` everywhere — only the source changes.

- [ ] **Step 5: Pass new props to `ShoppingListView`**

Find the `<ShoppingListView ... />` JSX. Add the three new props:

```tsx
<ShoppingListView
  householdId={householdId}
  items={items}
  onEditItem={setEditingItem}
  hasNextPage={hasNextPage}
  onLoadMore={() => fetchNextPage()}
  isFetchingNextPage={isFetchingNextPage}
/>
```

- [ ] **Step 6: Verify tsc clean and build**

Run:
```bash
cd FrontEnd && npx tsc --noEmit && npm run build 2>&1 | tail -10
```
Expected: tsc zero output, vite build succeeds.

- [ ] **Step 7: Report DONE**

Do NOT commit.

---

## Task 10: End-to-end manual smoke

**Files:** none (verification only)

This task does NOT modify code. It verifies the full feature works end-to-end and documents the smoke results. The implementer should run through the checklist on the user's behalf if they have access to a dev server, OR write up the checklist in the implementer report so the user can run it.

- [ ] **Step 1: Start backend and frontend dev servers**

```bash
cd BackEnd && npm run dev &
cd FrontEnd && npm run dev &
```

If the implementer can't start servers, document the steps for the user to run.

- [ ] **Step 2: Run the smoke checklist**

For each of the following, verify in the browser (or via direct API calls if no UI access):

**Active list pagination**
- With <50 items: list renders, no "Load more" button visible
- With >50 items (seed via DB): list shows first 50; "Load more" button at bottom; click → 51-100 appended
- Filter (search/category) re-fires from page 1 — pagination resets cleanly when queryKey changes

**Toggle bought + counter**
- Toggle bought on an item: optimistic update reflects in the list immediately
- "Done shopping (N)" updates: N comes from `useBoughtShoppingItems`, not the visible page
- After toggle settles: bought query refetches, count remains accurate

**Done shopping flow**
- Click "Done shopping" → `DoneShoppingDialog` shows all bought items in the household, regardless of currently visible page
- Confirm conversion → archive succeeds, items disappear from active list

**History pagination**
- With >10 trip entries: history renders first 10, "Load more" appears
- Click Load more → next 10 entries appended, no duplicates, no skips

**Same-millisecond cursor edge case**
- Trigger a Done-shopping conversion (multiple items in a trip share `archivedAt`)
- Manually archive a single item at approximately the same time
- Page through history with `limit=2` (or smaller, via direct API)
- Verify the manual entry is included on a subsequent page; no items lost

**Cursor failure modes**
- `GET /shopping-list?cursor=garbage` → 400
- `GET /shopping-list?limit=200` → 400 (validator)

- [ ] **Step 3: Report DONE with checklist results**

Implementer reports DONE and includes a summary of which smoke items passed/failed. Do NOT commit.

---

## Self-review

**Spec coverage:**
- ✅ Cursor format for active list (Task 4) — `(isBought, createdAt, _id)`
- ✅ Cursor format for history (Task 5) — `(archivedAt, _id)`
- ✅ Sort tiebreakers added (Tasks 4, 5)
- ✅ `.limit(500)` removed from active list (Task 4); retained on history (Task 5)
- ✅ Validator updates (Task 2)
- ✅ Controller passes new params (Task 3)
- ✅ Cursor parse error → BadRequestError (Task 4 helper, Task 5 helper)
- ✅ `useShoppingList` → infinite query (Task 7)
- ✅ `useBoughtShoppingItems` new hook (Task 7)
- ✅ Optimistic toggle adapted for paged shape (Task 7)
- ✅ "Load more" button (Task 8)
- ✅ ShoppingListPage wires new hooks (Task 9)
- ✅ End-to-end smoke (Task 10)

**Placeholder scan:** No "TODO", "TBD", or "implement later" placeholders. All code blocks contain complete, runnable code.

**Type consistency:** `ShoppingListPage` (Task 6) is the response type; `useShoppingList` returns `InfiniteData<ShoppingListPage>` via TanStack (Task 7); `ShoppingListView` props match (Task 8); `ShoppingListPage.tsx` consumer uses `data?.pages.flatMap(...)` (Task 9). Backend `IListItemsResult` matches the frontend `ShoppingListPage` shape: `{ items, nextCursor }`.

**Commits:** All tasks instruct the implementer NOT to commit. The user handles commits manually between (or after) tasks.
