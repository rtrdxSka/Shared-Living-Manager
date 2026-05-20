# Shopping List Tab — Design Spec

**Date**: 2026-04-30
**Branch**: `5-implement-couple-dashboard-and-algorithms`
**Scope**: Couple-dashboard only (v1)

---

## Context

The couple dashboard currently has tabs for Overview, Expenses, Tasks, Goals, Invite, and Account. Couples consistently coordinate grocery / household shopping in shared notes apps that are disconnected from the place where they then log the receipt as an expense. This duplicates effort and loses information (which items were on the list, who bought what).

This feature adds a **Shopping List** tab that doubles as the on-ramp to creating an expense: the user keeps a running list, checks items off as they buy them, and converts the checked items into a single pre-filled expense in one action. The two surfaces (list and expense form) share state, so the user only ever enters item names once.

The intended outcome:
- A persistent, shared list of items both partners can edit in real time
- A frictionless path from "I just shopped" → "the receipt is logged"
- A safety net so users don't accidentally lose a checked-off batch by navigating away

---

## Decisions Locked In

| Decision | Choice |
|---|---|
| Trigger to convert | **Both** — explicit "Done shopping" button (primary) + tab-leave nudge (safety net) |
| Item fields | `name` + `quantity` (free-form string) + `notes` (free-form string) |
| Post-conversion | Bought items are **deleted** from the list once the expense is saved |
| Bundling | One trip = one expense; only checked items are bundled in |
| Scope | Couple-only (tab hidden for roommate households) |
| "Paid by" default | Current user (the one who clicked "Done shopping"); overridable in the form |

---

## Out of Scope for v1 (deferred, document for later)

These were intentionally excluded so v1 stays focused. They can be added without architectural change:

- **Item categories** — tagging items as "groceries" / "household" / "personal" so the resulting expense category auto-picks. v1 always defaults the expense category to `"groceries"`.
- **"Frequent items" template** — quick-add chips for items the household buys regularly.
- **Multi-payer split** — converting one shopping trip into multiple expenses split by who paid. v1 produces a single expense with one payer.
- **Archive / history view** — bought items currently delete on conversion; no historical "what we bought when" view inside the shopping tab. The expense record itself is the history.
- **Recurring shopping items** — items that auto-re-add themselves on a cadence (e.g., milk every week).
- **Inline editing of items** — v1 supports add and delete only; to "edit" a typo, the user deletes the item and re-adds it. Future: a `PATCH /:itemId` endpoint with `updateItem` service method + an edit affordance in `ShoppingListView`.
- **Hard navigation guards** — blocking the browser back button / tab-close. v1 only guards in-app sidebar navigation (see implementation note below).
- **Once-per-session dismissal of leave-guard** — v1 fires the leave-guard prompt on every dirty-state leave; user dismisses to proceed. If the prompt proves annoying in practice, add a session-scoped suppression after first dismissal.

---

## Backend Design

Mirrors the tasks pattern (`task.model.ts` → `task.service.ts` → `task.controller.ts` → `task.routes.ts`).

### Model — `BackEnd/src/models/shopping-list-item.model.ts`

```ts
{
  householdId: ObjectId,         // indexed
  name: string,                  // required, trimmed
  quantity?: string,             // free-form ("2", "1L", "a bunch")
  notes?: string,
  addedByUserId: ObjectId,
  isBought: boolean,             // default false
  boughtAt?: Date,
  boughtByMemberId?: ObjectId,   // member subdoc _id, like task model
  createdAt, updatedAt           // timestamps
}
```

Compound index: `(householdId, isBought, createdAt)` so the list can fetch in two natural orders (pending first, bought first) without sorting in JS.

### Service — `BackEnd/src/services/shopping-list.service.ts`

Singleton class instance, mirroring `taskService`:

- `addItem(householdId, userId, input)` — verifies user is a member; creates item with `isBought=false`.
- `listItems(householdId, userId)` — verifies membership; returns all items, sorted by `isBought` asc then `createdAt` desc (pending on top, then bought).
- `toggleBought(householdId, userId, itemId)` — flips `isBought`. When flipping to `true`, sets `boughtAt = now` and `boughtByMemberId = current member._id`. When flipping to `false`, clears both.
- `deleteItem(householdId, userId, itemId)` — any member can delete any item (matches the "shared list" feel; consistent with task add/toggle being open).
- `clearBought(householdId, userId)` — bulk-delete all `isBought=true` items in one operation. Returns `{ deletedCount }`.

All methods use existing error utilities (`NotFoundError`, `ForbiddenError`, `BadRequestError` from `BackEnd/src/utils/error.ts`).

### Routes — mounted at `/api/households/:id/shopping-list`

| Method | Path | Handler |
|---|---|---|
| `POST` | `/api/households/:id/shopping-list` | addItem |
| `GET` | `/api/households/:id/shopping-list` | listItems |
| `PATCH` | `/api/households/:id/shopping-list/:itemId/bought` | toggleBought |
| `DELETE` | `/api/households/:id/shopping-list/:itemId` | deleteItem |
| `POST` | `/api/households/:id/shopping-list/clear-bought` | clearBought |

Use `mergeParams: true` and validate with `express-validator` (consistent with project patterns per `MEMORY.md`). Mount inside `household.routes.ts` next to the tasks router.

### Authorization

- All endpoints: caller must be a household member.
- v1 has no admin-only operations on the shopping list (any member can do anything). Matches "shared list" mental model.

---

## Frontend Design

### Types — `FrontEnd/src/types/shoppingList.types.ts`

```ts
export interface ShoppingListItemResponse {
  _id: string;
  householdId: string;
  name: string;
  quantity?: string;
  notes?: string;
  addedByUserId: string;
  isBought: boolean;
  boughtAt?: string;
  boughtByMemberId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
}
```

### API client — `FrontEnd/src/api/shoppingList.api.ts`

`shoppingListApi` object with: `listItems`, `addItem`, `toggleBought`, `deleteItem`, `clearBought`. Same shape and conventions as `taskApi` in `FrontEnd/src/api/task.api.ts`. All methods use the shared axios instance from `FrontEnd/src/utils/axios.ts`.

### Query hooks — `FrontEnd/src/hooks/queries/useShoppingListQueries.ts`

React-query hooks: `useListShoppingItems`, `useAddShoppingItem`, `useToggleShoppingItemBought`, `useDeleteShoppingItem`, `useClearBoughtShoppingItems`. Each mutation invalidates the list query on success. Re-export from `FrontEnd/src/hooks/queries/index.ts` (matching the existing barrel pattern).

### Page — `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`

- Fetches list via `useListShoppingItems`
- Renders header with "Add item" button (opens `AddShoppingItemForm`)
- Renders `ShoppingListView` (the actual list with checkboxes, edit, delete)
- Renders **"Done shopping"** primary action (visible only when ≥ 1 item is `isBought`)
- Hosts the leave-guard logic (see "Tab-leave safety-net" below)
- Lazy-imported in `App.tsx` like all other dashboard pages

### Components — `FrontEnd/src/components/dashboard/shared/`

- **`AddShoppingItemForm.tsx`** — Sheet (shadcn), structured exactly like `AddTaskForm.tsx`. Fields: `name` (required), `quantity` (optional), `notes` (optional textarea). Resets on close.
- **`ShoppingListView.tsx`** — list rendering. Each row: checkbox (toggles bought), name + quantity, notes (subtle), delete button. No inline edit in v1 — to fix a typo, the user deletes and re-adds.
- **`DoneShoppingDialog.tsx`** — Sheet/modal. Shows "Convert N items to an expense?" with a list summary. Single "Open expense form" button + Cancel.
- **`LeaveShoppingPromptDialog.tsx`** — hand-rolled modal (matching the `SetRotationDialog` style noted in `MEMORY.md`). Shown when the user attempts to navigate away from the shopping tab while bought-but-unconverted items exist. Two actions: "Convert now" / "Leave anyway".

### `AddExpenseForm` extension

Currently accepts `expense?: ExpenseResponse` for edit-mode hydration. Add a new prop:

```ts
initialValues?: Partial<AddExpenseInput>;  // prefill, but stay in create mode
```

In `useState` initializers and the `useEffect` that re-hydrates state, use `initialValues` when `expense` is undefined. **Do not** treat `initialValues` as edit mode — `isEditMode` continues to be derived from `expense !== undefined`. This keeps the form behavior unchanged for all existing callers.

### Routing & navigation

- **`App.tsx`**: add a lazy-imported `ShoppingListPage` and a route `path="shopping-list"` inside the dashboard `<Route>` block.
- **`FrontEnd/src/components/layout/AppLayout.tsx`**: in `useNavItems()`, conditionally include the Shopping List nav item when `household.type === 'couple'`.

### Dashboard context — `FrontEnd/src/contexts/DashboardContext.tsx`

Add hoisted state to mirror the tasks pattern:

- `addShoppingItemOpen`, `setAddShoppingItemOpen`
- `doneShoppingOpen`, `setDoneShoppingOpen`
- `leaveShoppingPromptOpen`, `setLeaveShoppingPromptOpen`
- `pendingNavigationPath`, `setPendingNavigationPath` — used by the leave guard to remember where the user wanted to go

Expose mutations via the context so components don't have to re-derive the household id at every call site.

---

## Two Checkout Flows

### Flow A — explicit "Done shopping" button (primary)

1. User checks ≥ 1 item; "Done shopping" button becomes visible at the bottom of the list.
2. Click → `DoneShoppingDialog` opens with a summary list of the bought items.
3. Click "Open expense form" in the dialog → close it, then open `AddExpenseForm` (Sheet) with prefilled values:
   - `description` = bought items joined as a comma-separated string. Format per item: `<quantity> <name>` if quantity present, else just `<name>`. Example: `"2 milk, 1 dozen eggs, toilet paper"`.
   - `paidByUserId` = current user's id
   - `category` = `"groceries"` (default)
   - `date` = today
   - `amount` = empty (user enters the receipt total)
4. User fills in `amount` and optionally adjusts other fields, then submits.
5. **On expense save success**: invoke `useClearBoughtShoppingItems` mutation → bought items disappear from list. Show a small success toast: "Logged £X — list cleared."
6. **On expense form cancel**: items stay checked. The user can retry from the same button. No data loss.

### Flow B — tab-leave safety net

**Constraint**: codebase uses `<BrowserRouter>` + `<Routes>` (legacy API). `useBlocker` requires the data router (`createBrowserRouter`), which is **not** available here. v1 will not migrate the router — too broad a blast radius for one feature.

**v1 implementation**: intercept **in-app sidebar clicks only**, not browser back/close.

- A `useShoppingListLeaveGuard()` hook on `ShoppingListPage` registers a "dirty" state in the dashboard context whenever bought-but-unconverted items exist on the list.
- The sidebar nav items in `AppLayout.tsx` read this flag. When clicked while dirty, instead of navigating, they call `setLeaveShoppingPromptOpen(true)` + `setPendingNavigationPath(targetPath)`.
- `LeaveShoppingPromptDialog` shows: "You have bought items not yet logged as an expense. Convert them now?"
  - **"Convert now"** → close the dialog, run Flow A starting at step 3 (`DoneShoppingDialog` → expense form). The pending nav path is preserved; once the expense is saved (or user cancels), navigate to it.
  - **"Leave anyway"** → close the dialog, navigate to `pendingNavigationPath`. Items remain on the list with their `isBought=true` state intact for next time.
- The prompt fires **every time** the user attempts to leave the shopping tab while dirty. No suppression after dismissal in v1 — if the prompt proves annoying in practice, a session-scoped suppression can be added later (see "Out of Scope").

**Explicitly not handled in v1** (and called out in code comments to avoid future confusion):
- Browser back button
- Tab/window close
- Direct URL change
- Refresh

If the user wants those guarded later, that's a follow-up — likely via migrating to the data router so `useBlocker` becomes available.

---

## Critical Files to Modify or Create

**New files:**
- `BackEnd/src/models/shopping-list-item.model.ts`
- `BackEnd/src/services/shopping-list.service.ts`
- `BackEnd/src/controllers/shopping-list.controller.ts`
- `BackEnd/src/routes/shopping-list.routes.ts`
- `BackEnd/src/validators/shopping-list.validators.ts`
- `BackEnd/src/types/shopping-list.types.ts` — only if the backend follows a separate-types-files convention; mirror what `task.types.ts` does (or doesn't). Verify before creating.
- `FrontEnd/src/types/shoppingList.types.ts`
- `FrontEnd/src/api/shoppingList.api.ts`
- `FrontEnd/src/hooks/queries/useShoppingListQueries.ts`
- `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`
- `FrontEnd/src/components/dashboard/shared/AddShoppingItemForm.tsx`
- `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx`
- `FrontEnd/src/components/dashboard/shared/DoneShoppingDialog.tsx`
- `FrontEnd/src/components/dashboard/shared/LeaveShoppingPromptDialog.tsx`

**Modified files:**
- `BackEnd/src/routes/household.routes.ts` — mount the shopping-list router under `/:id/shopping-list`
- `FrontEnd/src/App.tsx` — register the lazy-imported page + route
- `FrontEnd/src/components/layout/AppLayout.tsx` — add the nav item, conditional on `household.type === 'couple'`
- `FrontEnd/src/contexts/DashboardContext.tsx` — hoist sheet/dialog state and pending nav path
- `FrontEnd/src/components/dashboard/shared/AddExpenseForm.tsx` — add `initialValues?` prop, hydrate from it when `expense` is undefined
- `FrontEnd/src/hooks/queries/index.ts` — re-export shopping-list query hooks

**Reused existing utilities (do not duplicate):**
- Error helpers — `BackEnd/src/utils/error.ts` (`NotFoundError`, `ForbiddenError`, `BadRequestError`)
- Axios instance — `FrontEnd/src/utils/axios.ts`
- Auth context / current user — `FrontEnd/src/contexts/AuthContext`
- Sheet primitives — `FrontEnd/src/components/ui/sheet`
- API success type — `FrontEnd/src/types/auth.types.ts` (`ApiSuccessResponse`)
- Task scaffolding patterns — every task file is a direct template for its shopping-list counterpart

---

## Verification Plan

End-to-end the feature works if **all** of these checks pass:

1. **Backend unit & integration**:
   - Add an item via `POST` → it appears in `GET`.
   - Toggle bought via `PATCH /:itemId/bought` → `isBought` flips, `boughtAt` and `boughtByMemberId` are set / cleared.
   - `clearBought` deletes only items with `isBought=true` and leaves pending items intact.
   - Authorization: a non-member receives `403 ForbiddenError` on every endpoint.

2. **Frontend manual run** (couple household with two members in dev):
   - Member A adds three items.
   - Member B sees them on the same tab after a query refetch.
   - Member A checks two items as bought → "Done shopping" button appears.
   - Member A clicks it → confirmation dialog summarises the two items → opens expense sheet with prefilled description, today's date, current user as payer, category = groceries, amount empty.
   - Member A enters £45, saves → expense appears in `Expenses` tab → bought items disappear from shopping list → unchecked third item still on list.
   - Member A re-checks the third item, then clicks the sidebar "Expenses" link → leave-guard modal appears. "Leave anyway" → navigates to expenses, item stays checked. Returning to shopping tab shows item still checked.
   - Member A checks an item, clicks "Convert now" in the leave guard → flow proceeds, lands on the originally-clicked target page after expense save.
   - Roommate household: shopping-list nav item is **not** shown.

3. **Type & lint checks**:
   - `npm run typecheck` passes in both `FrontEnd` and `BackEnd`.
   - No new lint warnings.

4. **Token / auth regressions**: existing JWT flow untouched. Confirm by running through login → dashboard → shopping list end-to-end without re-auth prompts.

---

## Notes for Implementation Plan

- Build backend first (model → service → controller → routes), test via REST tooling (Postman / curl) before touching the UI.
- Frontend order: types → api → hooks → page skeleton → AddShoppingItemForm → ShoppingListView → AddExpenseForm `initialValues` extension → DoneShoppingDialog → LeaveShoppingPromptDialog → wire leave-guard via DashboardContext last (most fragile piece).
- The `AddExpenseForm` extension is small but touches an existing component used elsewhere — verify the expenses tab still creates and edits expenses correctly after the change.
- The leave-guard sidebar interception is a tasteful hack, not a clean architectural pattern. Comment the intent clearly. Flag it as the first candidate to revisit if/when the codebase migrates to the data router.
