# Shopping List v2 — Design Spec

**Date**: 2026-04-30
**Branch**: `5-implement-couple-dashboard-and-algorithms`
**Builds on**: `docs/superpowers/specs/2026-04-30-shopping-list-design.md` (v1)
**Scope**: Couple-dashboard only (inherited from v1)

---

## Context

Shopping List v1 shipped a working active-list + Done-shopping → expense flow but explicitly deferred a set of polish features as YAGNI for the first cut. Real use surfaced friction:

- The hardcoded `'groceries'` category meant every shopping trip turned into a misclassified expense if any non-grocery items were on the receipt (cleaning supplies, household, internet — same dropdown, no way to set it per item).
- Bought items were **deleted** on conversion. Once converted, you couldn't see what was on a past trip without opening the matching expense (which only stored a string description, not structured items).
- Edit was missing entirely — typos required delete + re-add.
- The leave-guard caught only in-app sidebar clicks. Closing the tab or hard-refreshing silently dropped checked items. Browser back/forward also slipped through.
- There was no way to "park" an item ("not buying this week, but might later") without losing it.

This spec adds those four deferred features plus two more the user asked for during brainstorming (manual archive + restore, paginated history). Together they take the shopping list from a one-shot "buy → convert → forget" flow to a coherent active-list + history surface.

The intended outcome:
- Items carry a category that drives the converted expense's category accurately
- Past trips and manually-archived items are browsable as history grouped per trip with a link back to the expense
- Items are inline-editable
- Tab close, hard refresh, and direct URL changes prompt before discarding bought items
- Items can be archived without buying them (and restored later if plans change)

---

## Decisions locked in (from brainstorming)

| Topic | Choice |
|---|---|
| Hard navigation guards | `beforeunload` only — keep current `<BrowserRouter>` router. Catches tab close, hard refresh, direct URL change. Browser back/forward stays uncovered (deferred). |
| Item category source | `EXPENSE_TYPES` enum (`rent` / `utilities` / `internet` / `groceries` / `cleaning` / `subscriptions` / `other`) |
| Category required? | Yes, at add-time. Default `'groceries'` in the form. Editable via inline edit. |
| Expense conversion | ONE expense per trip. Category = the dominant (most common) item category, ties broken by earliest `createdAt` of items in the tied categories. Description groups items by category. User can override category in the form. |
| Archive view location | Same page (`/dashboard/shopping-list`) with `Active` / `History` tabs (shadcn Tabs). |
| Archive metadata | Group by trip with expense link. Each archived item carries `archivedAt` and `archivedExpenseId` (null for manual archives). |
| Inline edit affordance | Pencil icon on each row → opens `AddShoppingItemForm` in edit mode (mirrors `AddExpenseForm.expense?` prop pattern). |
| Manual archive affordance | Archive-box icon next to pencil + trash on each active row. Single click. |
| Restore | Only **manual** archives are restorable. Conversion archives are settled history. |
| Pagination | Cursor-based "Load more", 10 entries per page. Server-side trip grouping. |

---

## Out of scope for v2 (still YAGNI)

- **Browser back/forward guard** — needs `<BrowserRouter>` → `createBrowserRouter` migration + `useBlocker`. Deferred to a later spec because the migration touches `App.tsx` broadly.
- **Bulk archive / select-many** — single-row icons only.
- **Search / filter on history** — no search box, no filter chips.
- **Auto-prune of old archived items** — items remain until hard-deleted.
- **Per-item price tracking** — receipt total still goes onto the single expense; we don't split per item.
- **Restoring conversion-archived items** — explicit no. The expense exists; restoring would create awkward state.
- **"Frequent items" template** — still YAGNI.
- **Recurring shopping list items** — still YAGNI.

---

## Item lifecycle (revised)

```
ACTIVE (default)
   │
   ├─[user clicks archive icon]──► MANUAL ARCHIVE
   │                                  │   archivedAt = now
   │                                  │   archivedExpenseId = null
   │                                  │
   │                                  └─[user clicks Restore in history]──► back to ACTIVE
   │                                                                         (isBought = false, archivedAt = null)
   │
   └─[user checks bought + Done shopping + expense saved]──► CONVERSION ARCHIVE
                                                              │   archivedAt = now
                                                              │   archivedExpenseId = <new expense._id>
                                                              │   archivedDominantCategory = <computed>
                                                              │
                                                              └─[user hard-deletes from history]──► gone forever
```

The two archive states are distinguished by whether `archivedExpenseId` is set. Manual archive ignores `isBought` — works on any active item, including ones the user has already checked as bought.

---

## Data model changes

### `ShoppingListItem` (Mongoose model)

Add three fields. The existing fields are preserved.

```ts
{
  // existing v1 fields ...
  category: ExpenseType,          // required, enum, default 'groceries'
  archivedAt?: Date,              // null = active; non-null = archived (either kind)
  archivedExpenseId?: ObjectId,   // null = manual archive; non-null = conversion archive
  archivedDominantCategory?: ExpenseType,  // only set on conversion archive (snapshot of trip's dominant)
}
```

The schema's `default: 'groceries'` covers reads of pre-v2 documents that don't have the field.

### Indexes

Existing `(householdId, isBought, createdAt)` keeps serving the active list. Add:

```ts
shoppingListItemSchema.index({ householdId: 1, archivedAt: -1 });
```

This index supports the descending-by-archive-time pagination of the history endpoint. The active-list query continues to use the existing index because we'll filter `archivedAt: null` (or `$exists: false`) on the active path.

### Migration

For existing dev databases (one user, fresh feature, no real data): no migration needed — the schema default handles new reads. If the user has v1 items they care about, run once via `mongosh`:

```js
db.shoppinglistitems.updateMany(
  { category: { $exists: false } },
  { $set: { category: 'groceries' } }
);
```

Documented in the implementation plan; not required for the masters-project dev workflow.

---

## Backend design

### Service (`BackEnd/src/services/shopping-list.service.ts`)

Existing v1 methods change:

- **`addItem`** — now accepts `category: ExpenseType` (required). Validates against `EXPENSE_TYPES`. Persists category on the item.
- **`listItems`** — accepts optional `{ archived?: boolean }` filter. Default `false` (active only — adds `archivedAt: null` to the Mongo filter).
- **`clearBought` is removed** — replaced by `archiveBought` below.

New service methods:

- **`updateItem(householdId, userId, itemId, input)`** — partial update of `name | quantity | notes | category`. Refuses with `BadRequestError` if the target item is archived (`archivedAt != null`).
- **`archiveItem(householdId, userId, itemId)`** — manual archive. Sets `archivedAt = now`. Does **not** set `archivedExpenseId`. Refuses if item is already archived.
- **`restoreItem(householdId, userId, itemId)`** — clears `archivedAt`, sets `isBought = false`. Refuses with `BadRequestError` if `archivedExpenseId` is set (conversion archive — not restorable). Refuses if item is not archived.
- **`archiveBought(householdId, userId, expenseId, dominantCategory)`** — replaces `clearBought`. For all items in the household with `isBought = true && archivedAt = null`, sets `archivedAt = now`, `archivedExpenseId = expenseId`, `archivedDominantCategory = dominantCategory`. Returns `{ archivedCount }`.
- **`listArchivedHistory(householdId, userId, cursor?, limit = 10)`** — returns paginated, server-side-grouped history entries.

### Server-side grouping for history

The history endpoint serves one of two entry types per element:
- **Trip entry**: items sharing the same `archivedExpenseId`, grouped together
- **Manual entry**: a single item with `archivedExpenseId = null`, on its own

The simplest implementation:

```ts
// Pseudocode
const items = await ShoppingListItem.find({
  householdId,
  archivedAt: { $ne: null, ...(cursor ? { $lt: new Date(cursor) } : {}) },
})
  .sort({ archivedAt: -1 })
  .lean();

// Group in JS — manageable since pagination keeps the page small
const groups = new Map<string, HistoryEntry>();  // key = expenseId or `manual:<itemId>`
for (const item of items) {
  const key = item.archivedExpenseId
    ? `trip:${item.archivedExpenseId.toString()}`
    : `manual:${item._id.toString()}`;
  if (!groups.has(key)) {
    groups.set(key, item.archivedExpenseId ? buildTripEntry(item) : buildManualEntry(item));
    if (groups.size > limit) break;  // stop after collecting `limit` groups
  }
  groups.get(key)!.items.push(toResponse(item));
}

const entries = Array.from(groups.values()).slice(0, limit);
const nextCursor = entries.length === limit ? entries[entries.length - 1].archivedAt : null;
```

The "fetch all archived items, group in memory, slice" approach is correct for typical household volumes (tens to a few hundred archived items). If the dataset grows beyond ~10k archived items, switch to a Mongo aggregation pipeline with `$group` and `$limit`. That's a simple optimization to defer.

**Cursor semantics**: an ISO date string. The next page's query becomes `archivedAt < cursor`. Because items in a single trip share an `archivedAt` to the millisecond (set in one operation by `archiveBought`), no trip will be split across pages — they all sort together.

### HTTP endpoints

| Method | Path | Handler |
|---|---|---|
| `POST` | `/api/households/:id/shopping-list` | `addItem` (now requires `category` in body) |
| `GET` | `/api/households/:id/shopping-list` | `listItems` — default active; `?archived=true` returns archived raw (used internally, not by history view) |
| `PATCH` | `/api/households/:id/shopping-list/:itemId` | `updateItem` |
| `PATCH` | `/api/households/:id/shopping-list/:itemId/bought` | `toggleBought` (unchanged from v1) |
| `POST` | `/api/households/:id/shopping-list/:itemId/archive` | `archiveItem` (manual archive) |
| `POST` | `/api/households/:id/shopping-list/:itemId/restore` | `restoreItem` |
| `DELETE` | `/api/households/:id/shopping-list/:itemId` | `deleteItem` (hard delete, works on active or archived) |
| `POST` | `/api/households/:id/shopping-list/archive-bought` | `archiveBought` (replaces `clear-bought`); body `{ expenseId, dominantCategory }` |
| `GET` | `/api/households/:id/shopping-list/history?cursor=&limit=` | `listArchivedHistory` |

### History response contract

```ts
type HistoryEntry =
  | {
      type: 'trip';
      archivedAt: string;  // ISO; latest in this trip (all items share this in practice)
      items: ShoppingListItemResponse[];
      expenseId: string;
      dominantCategory: ExpenseType;
    }
  | {
      type: 'manual';
      archivedAt: string;
      items: ShoppingListItemResponse[];  // length 1
    };

interface HistoryResponse {
  entries: HistoryEntry[];
  nextCursor: string | null;  // ISO of last entry's archivedAt, or null = no more
}
```

### Validators (express-validator)

- `addShoppingItemValidation` — adds `body('category').isIn(EXPENSE_TYPES).withMessage(...)`.
- `updateShoppingItemValidation` — new. All four fields optional; each validated when present.
- `archiveBoughtValidation` — new. `body('expenseId').isMongoId()`, `body('dominantCategory').isIn(EXPENSE_TYPES)`.
- `historyValidation` — new. Optional `query('cursor').isISO8601()`, optional `query('limit').isInt({ min: 1, max: 50 })`.

### Authorization (unchanged)

All endpoints require household membership. No admin-only operations on the shopping list — any member can add, edit, archive, restore, delete, and view history. Mirrors the v1 "shared list" rule.

---

## Frontend design

### Types (`FrontEnd/src/types/shoppingList.types.ts`)

Add:
```ts
import type { ExpenseType } from '@/types/onboarding.types';

// extends existing v1 type
interface ShoppingListItemResponse {
  // ... existing v1 fields
  category: ExpenseType;
  archivedAt?: string;
  archivedExpenseId?: string;
  archivedDominantCategory?: ExpenseType;
}

// extends existing v1 type
interface AddShoppingItemInput {
  // ... existing v1 fields
  category: ExpenseType;
}

interface UpdateShoppingItemInput {
  name?: string;
  quantity?: string;
  notes?: string;
  category?: ExpenseType;
}

type HistoryEntry = TripHistoryEntry | ManualHistoryEntry;
interface TripHistoryEntry {
  type: 'trip';
  archivedAt: string;
  items: ShoppingListItemResponse[];
  expenseId: string;
  dominantCategory: ExpenseType;
}
interface ManualHistoryEntry {
  type: 'manual';
  archivedAt: string;
  items: ShoppingListItemResponse[];  // length 1
}
interface HistoryPage {
  entries: HistoryEntry[];
  nextCursor: string | null;
}
```

### API client (`FrontEnd/src/api/shoppingList.api.ts`)

Existing `clearBought` is renamed/replaced by `archiveBought({ expenseId, dominantCategory })`. New methods: `updateItem`, `archiveItem`, `restoreItem`, `listArchivedHistory({ cursor, limit })`.

### Query hooks (`FrontEnd/src/hooks/queries/useShoppingListQueries.ts`)

Existing `useShoppingList` continues to fetch active items (backend filters out archived by default). Existing `useClearBoughtShoppingItems` is removed; replaced by `useArchiveBoughtShoppingItems`.

New:
- `useUpdateShoppingItem(householdId)`
- `useArchiveShoppingItem(householdId)` — manual archive
- `useRestoreShoppingItem(householdId)`
- `useArchivedHistory(householdId)` — TanStack `useInfiniteQuery` with `getNextPageParam: (lastPage) => lastPage.nextCursor`

`queryKeys` factory gains `shoppingList.history(householdId)`.

All mutations invalidate both `shoppingList.list` and `shoppingList.history` so add/archive/restore/delete refresh both views.

### `AddShoppingItemForm` extension

Mirrors how `AddExpenseForm` accepts `expense?` for edit mode. Add prop `item?: ShoppingListItemResponse`. Behaviour:

- When `item` is provided, the form is in **edit mode**:
  - State initialized from `item` (name, quantity, notes, category)
  - Submit calls `useUpdateShoppingItem` mutation
  - Submit button reads "Save changes"
  - On success, `onOpenChange(false)`; the parent clears its `editingItem` state
- When `item` is absent (current v1 behaviour), the form is in **create mode**:
  - All fields blank/defaults (name='', quantity='', notes='', category='groceries')
  - Submit calls `useAddShoppingItem`
  - Submit button reads "Add item"

The form gains a Category dropdown using shadcn `Select` populated from `EXPENSE_TYPES` with friendly labels (e.g., `'groceries'` → "Groceries"). Existing `EXPENSE_TYPE_LABELS` (or whatever the codebase uses for the Expenses tab) is reused; if it doesn't exist yet, it's added to `FrontEnd/src/types/onboarding.types.ts` next to `EXPENSE_TYPES` and exported.

### `ShoppingListView` (active list)

Each row's icon column expands from 1 to 3 icons, left-to-right by frequency-of-use:
1. **Pencil** (Lucide `Pencil`) → `onEditItem(item)` callback
2. **Archive box** (Lucide `Archive`) → `onArchiveItem(item._id)` (calls `useArchiveShoppingItem`)
3. **Trash** (Lucide `Trash2`) → `onDeleteItem(item._id)` (existing v1)

Each row also gains a small **category badge** (e.g., a Tailwind pill) showing the friendly category label, positioned between the name/quantity text and the icon column. Color/style mirrors how the Expenses tab badges category (if such a treatment exists; otherwise a plain bordered pill is fine).

### `ShoppingHistoryView` (new)

Read-only view rendered when the History tab is active. Uses `useArchivedHistory(householdId)`.

Renders one card per `HistoryEntry`:

- **Trip card** (`type='trip'`):
  - Header row: archive date · dominant category badge · item count · "View expense" link
  - "View expense" navigates to `/dashboard/expenses` (no scroll-to-specific-expense in v2 — YAGNI; user can find the expense by date)
  - Items list below the header, rendered with category badges (matching v1 row layout but read-only — no checkboxes, no edit/archive icons)
  - A small trash icon in the header for **hard-deleting the entire trip** (cascades a delete across all items in the trip — implemented as N parallel `deleteItem` calls or a dedicated bulk endpoint; for v2 keep it simple — frontend loops through items and calls `deleteItem` per item, then invalidates the history query)

- **Manual card** (`type='manual'`):
  - Single item row: name · quantity · notes · category badge · archive date
  - **Restore** button (Lucide `RotateCcw` icon + "Restore" label) → `useRestoreShoppingItem`
  - Trash icon → hard-delete this single archived item

At the bottom of the rendered list:
- If `hasNextPage`: a **"Load more"** button calling `fetchNextPage`. Disabled and shows spinner while `isFetchingNextPage`.
- If empty: empty-state placeholder "No history yet. Items appear here after you mark them bought and convert to an expense, or after archiving from the active list."

### `ShoppingListPage` (revised)

```tsx
const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
const [editingItem, setEditingItem] = useState<ShoppingListItemResponse | null>(null);

// useBeforeUnload guards while there are unconverted bought items
useBeforeUnload(boughtItems.length > 0);
```

Rendering:
```
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="active">Active</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  <TabsContent value="active">
    {/* existing v1 active-list UI, with new category badges + 3-icon column */}
    <ShoppingListView
      householdId={householdId}
      items={items}
      onEditItem={setEditingItem}
    />
    {hasBought && (<DoneShoppingButton .../>)}
  </TabsContent>
  <TabsContent value="history">
    <ShoppingHistoryView householdId={householdId} />
  </TabsContent>
</Tabs>
```

The `AddShoppingItemForm` gains the `item={editingItem ?? undefined}` prop. When `editingItem` is non-null, the form is open in edit mode; when null, the form's `addOpen` boolean controls add mode. Both modes use the same Sheet — the parent decides which mode by setting `editingItem`.

The conversion flow updates one line: instead of `useClearBoughtShoppingItems`, it calls `useArchiveBoughtShoppingItems` with `{ expenseId: created._id, dominantCategory }`. `dominantCategory` is computed in the page from `boughtItems` before calling.

### Hard navigation guard — `useBeforeUnload(active: boolean)` hook

A small new hook (placed in `FrontEnd/src/hooks/useBeforeUnload.ts` or similar):

```tsx
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';  // legacy; modern browsers ignore custom strings
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}
```

Wired in `ShoppingListPage` as `useBeforeUnload(boughtItems.length > 0)`. Catches:
- Tab close
- Window close
- Hard refresh (Ctrl+R / Cmd+R)
- Direct URL change (typing a new URL into the address bar)

Does NOT catch (acknowledged — deferred):
- Browser back / forward arrow buttons
- React Router programmatic navigation (already handled by the existing in-app sidebar guard via `useGuardedNavClick`)

**Coverage layering**: the v1 in-app sidebar guard and the new `beforeunload` cover disjoint events — `useGuardedNavClick` intercepts in-app `<Link>` clicks before React Router runs, while `beforeunload` fires on browser-level page-unload events. They never trigger for the same action, so no de-duplication is needed. Both are gated on the same `boughtItems.length > 0` predicate so they stay in sync about when the page is dirty.

---

## Manual archive flow

1. User clicks the archive-box icon on an active row.
2. Frontend calls `useArchiveShoppingItem.mutate(item._id)`.
3. Backend `archiveItem`: verifies membership, sets `archivedAt = now`, leaves `archivedExpenseId` null.
4. On success, the active list query invalidates → the item disappears from Active.
5. The item is now visible in History tab as a `type='manual'` entry with a Restore button.
6. The user can either Restore it (returns to Active) or hard-delete it (gone).

There is no confirmation modal — the operation is reversible (Restore from history) and recoverable (item still exists in DB until hard-deleted).

---

## Restore flow

1. User clicks Restore on a `type='manual'` history card.
2. Frontend calls `useRestoreShoppingItem.mutate(item._id)`.
3. Backend `restoreItem`: verifies membership, **refuses with `BadRequestError`** if `archivedExpenseId` is set (defensive — UI doesn't show Restore for trip cards, but a malicious or stale request must not bypass the rule). Otherwise clears `archivedAt`, sets `isBought = false`.
4. On success, both queries invalidate → the item disappears from History and reappears in Active (unchecked).

---

## "Done shopping" → archiveBought flow (revised)

The conversion flow's last step changes from "delete" to "archive":

1. User clicks Done shopping → `DoneShoppingDialog` confirms → `AddExpenseForm` opens prefilled.
2. The page computes `dominantCategory` from `boughtItems` (most common category, ties broken by first-added).
3. The expense form's prefilled `category` is set to `dominantCategory` (instead of hardcoded `'groceries'`).
4. The expense description groups items by category, e.g.: `"GROCERIES: 2L milk, 1 dozen eggs · CLEANING: sponge"`. Format chosen for readability and grep-ability inside the expense description.
5. User submits expense → `onCreated(created)` callback fires.
6. Page calls `useArchiveBoughtShoppingItems.mutate({ expenseId: created._id, dominantCategory })` — replaces the v1 `useClearBoughtShoppingItems` call.
7. Backend `archiveBought` archives all `isBought=true && archivedAt=null` items in one operation, all sharing `archivedAt = now`, `archivedExpenseId = expenseId`, `archivedDominantCategory = dominantCategory`.
8. Active list refetches (no more bought items). History tab shows a new trip entry at the top.
9. Pre-existing in-app leave guard still works (clears with the bought count going to zero); the new `beforeunload` guard also disengages (`boughtItems.length === 0` after archive).

---

## Pagination mechanics

- Initial fetch: no cursor → first 10 entries
- "Load more" click: `fetchNextPage()` from `useInfiniteQuery` → backend gets `cursor=<archivedAt of the last entry of the last fetched page>`
- Backend returns next 10 entries with `archivedAt < cursor`
- TanStack appends to the page list; the rendered entries grow
- When `nextCursor === null`, the "Load more" button hides
- Edge: if a new entry is archived (e.g., by partner) while the user is mid-pagination, it appears at the top on the next refetch (e.g., after a mutation invalidates the history query). Cursors don't shift because they're timestamp-based, not index-based.

---

## Critical files

### New files

**Backend:**
- (no new files — all changes go into existing v1 service / controller / routes / validators)

**Frontend:**
- `FrontEnd/src/components/dashboard/shared/ShoppingHistoryView.tsx` — new component for the History tab content
- `FrontEnd/src/hooks/useBeforeUnload.ts` — small hook (4 lines of body) for the hard guard
- (existing `AddShoppingItemForm.tsx`, `ShoppingListView.tsx`, `ShoppingListPage.tsx` are extended in place)

### Modified files

**Backend:**
- `BackEnd/src/types/shopping-list.types.ts` — add `category`, archive fields, `IUpdateShoppingItemInput`, history response types
- `BackEnd/src/models/shopping-list-item.model.ts` — add `category`, archive fields, new index
- `BackEnd/src/validators/shopping-list.validator.ts` — `category` validation in add/update; new `updateShoppingItemValidation`, `archiveBoughtValidation`, `historyValidation`
- `BackEnd/src/services/shopping-list.service.ts` — `category` handling in `addItem`/`listItems`; new `updateItem`, `archiveItem`, `restoreItem`, `archiveBought` (replaces `clearBought`), `listArchivedHistory`
- `BackEnd/src/controllers/shopping-list.controller.ts` — endpoints for the 5 new/changed routes
- `BackEnd/src/routes/shopping-list.routes.ts` — wire up new routes; remove `/clear-bought`

**Frontend:**
- `FrontEnd/src/types/shoppingList.types.ts` — extended types per "Types" section above
- `FrontEnd/src/types/onboarding.types.ts` — if `EXPENSE_TYPE_LABELS` doesn't already exist, add it for friendly category names
- `FrontEnd/src/api/shoppingList.api.ts` — new methods: `updateItem`, `archiveItem`, `restoreItem`, `archiveBought` (renamed from `clearBought`), `listArchivedHistory`
- `FrontEnd/src/hooks/queries/useShoppingListQueries.ts` — new hooks: `useUpdateShoppingItem`, `useArchiveShoppingItem`, `useRestoreShoppingItem`, `useArchivedHistory` (infinite query), `useArchiveBoughtShoppingItems` (renamed)
- `FrontEnd/src/hooks/queries/index.ts` — re-export new hooks; remove `useClearBoughtShoppingItems`
- `FrontEnd/src/lib/queryKeys.ts` — add `shoppingList.history(householdId)`
- `FrontEnd/src/components/dashboard/shared/AddShoppingItemForm.tsx` — `item?` prop, edit mode, Category dropdown
- `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx` — 3 icons per row, category badge, `onEditItem` prop, `onArchiveItem` prop
- `FrontEnd/src/components/dashboard/shared/DoneShoppingDialog.tsx` — group items by category in the summary list; surface dominant category in confirmation copy
- `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx` — `<Tabs>` with Active/History, `editingItem` state, `useBeforeUnload`, archiveBought wiring with `dominantCategory`

### Reused (do not duplicate)

- `EXPENSE_TYPES`, `ExpenseType` — `FrontEnd/src/types/onboarding.types.ts`
- shadcn `<Tabs>`, `<Sheet>`, `<Select>`, `<Button>` — `FrontEnd/src/components/ui/`
- TanStack `useInfiniteQuery` — already on the dependency
- Lucide icons: `Pencil`, `Archive`, `Trash2`, `RotateCcw`, `ShoppingCart` — already imported elsewhere

---

## Verification plan

End-to-end the feature works if **all** of these checks pass:

### Backend (manual via curl with a real JWT)

1. **Add with category**: `POST /shopping-list { name: "milk", category: "groceries" }` → 201, item has `category: "groceries"`.
2. **Add without category**: same call without `category` field → 400 (express-validator rejects).
3. **Update**: `PATCH /shopping-list/:id { category: "cleaning" }` → 200, item's category is now "cleaning".
4. **Update archived item**: archive an item, then PATCH it → 400 (`BadRequestError`).
5. **Manual archive**: `POST /shopping-list/:id/archive` → 200, item disappears from `GET /shopping-list`, appears in `GET /shopping-list/history` as a `type='manual'` entry.
6. **Restore manual archive**: `POST /shopping-list/:id/restore` → 200, item is back in `GET /shopping-list` with `isBought=false`.
7. **Restore conversion archive**: archive via `archive-bought`, then call restore → 400 (`BadRequestError`).
8. **archive-bought**: with two bought items in the list, call `POST /shopping-list/archive-bought { expenseId: "...", dominantCategory: "groceries" }` → 200, `archivedCount: 2`. Both items disappear from the active list. They appear as a single trip entry in history.
9. **History pagination**: archive 25+ entries, `GET /shopping-list/history?limit=10` → 10 entries + `nextCursor`. Call again with that cursor → next 10. Continue until `nextCursor: null`.
10. **History grouping**: a trip with 5 items archived together appears as ONE trip entry containing all 5 items (not 5 separate entries).

### Frontend (manual UI walkthrough)

In a couple-mode dev household with two members:

1. Active tab: add 3 items, each with a different category (groceries, cleaning, internet). Verify category badges render on each row.
2. Click pencil on one item → form opens prefilled. Change category to "utilities", change name. Save. Verify the row updates without a page reload.
3. Click archive icon on an item → it disappears from Active.
4. Switch to History tab → the archived item appears as a manual card with Restore button.
5. Click Restore → item returns to Active (unchecked).
6. Mark two items bought (one groceries, one cleaning), click "Done shopping".
   - Confirmation dialog shows: "Convert these 2 bought items into a single GROCERIES expense" (groceries is dominant since 1 vs 1 ties broken by first-added; verify whichever rule the spec says).
   - Expense form opens prefilled with description `"GROCERIES: <name> · CLEANING: <name>"`, category set to dominant.
   - Submit expense.
   - Active list shows only the third (untouched) item.
   - Switch to History tab → a new trip card at the top with both items, expense link, and dominant category badge.
   - Click "View expense" → navigates to `/dashboard/expenses` (the matching expense visible).
7. Add 11 more trips via repeated bought + archive flows. History tab shows 10 entries + "Load more". Click → next 10 (in this case, just 1) load.
8. **Hard guard test**: from Active tab with one item checked as bought, hit Ctrl+R / try to close the tab → browser confirms ("Leave site?"). Cancel → still on the page. Confirm → page reloads, item still on list (only the in-memory bought-count was being guarded; no data was at risk).
9. **Mobile**: same flow on a narrow window. Tabs work; bottom nav stays functional; "Load more" tappable.
10. Roommate dashboard: shopping-list nav still hidden (inherited from v1 — couple-only feature).

### Type & lint checks

- `cd BackEnd && npm run type-check` passes
- `cd FrontEnd && npx tsc --noEmit` passes
- `cd FrontEnd && npm run lint` shows no NEW warnings (pre-existing v1 issues acceptable)
- `cd FrontEnd && npm run build` succeeds

---

## Notes for the implementation plan

- Order: backend first (model → service → controller → routes → curl), then frontend types/api/hooks, then components (AddShoppingItemForm extension first since other components depend on its edit-mode contract), then the page wiring last.
- `clearBought` → `archiveBought` is a breaking API change. Since v1 is on the same branch and not deployed, do the rename in a single task (delete the old method/route/hook, add the new) without backwards-compat aliases.
- The frontend's leave-guard in v1 (`useGuardedNavClick` + dirty state in `DashboardContext`) is unchanged. The new `useBeforeUnload` is independent and additive — it doesn't touch the existing guard's wiring.
- The `ShoppingHistoryView` component is the largest single new piece. Worth a focused subagent dispatch with the full contract (entry types, pagination, two card variants, infinite query usage).
- The `dominantCategory` computation lives on the frontend (`ShoppingListPage`) and is passed into `archiveBought`. Place a helper `computeDominantCategory(items: ShoppingListItemResponse[]): ExpenseType` in the page or a small utility — same logic for the prefilled expense category and the `archivedDominantCategory` snapshot.
