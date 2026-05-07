# Shopping List v3 — Design Spec

**Date**: 2026-05-06
**Branch**: `5-implement-couple-dashboard-and-algorithms`
**Builds on**: `docs/superpowers/specs/2026-04-30-shopping-list-v2-design.md` (v2)
**Scope**: Couple-dashboard only (inherited from v1/v2)

---

## Context

Shopping List v2 shipped categories, inline edit, manual archive, History tab, and a hard-navigation guard. Three features were explicitly listed as YAGNI for v2 and are now being added as v3:

1. **Search + chip filter** — once the active list grows past ~10 items, scanning for "is dish soap on the list already?" becomes friction. The History tab has the same problem at larger scales.
2. **History auto-prune** — `archivedAt` items currently live forever. A couple shopping weekly will accumulate hundreds of trip rows after a year. Most of that history is never re-read; the storage and visual noise cost outweighs the value.
3. **Recurring shopping items** — staples (milk, bread, dish soap) are added to the list every week or month by hand. A small rule store + scheduled job can re-add them automatically and dedupe against existing active items.

All three are additive — no breaking changes to v2 contracts. They reuse existing patterns:

- TTL index pattern from `BackEnd/src/models/cron-lock.model.ts`
- `scheduleWithLock(...)` from `BackEnd/src/scheduler/cronLock.ts`
- `BackEnd/src/scheduler/recurringExpenses.ts` as the scheduler-file template
- `<Tabs>` shell on `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`
- The existing `AddShoppingItemForm` shape and modal pattern

The intended outcome:

- Members can find any item on the active list or in history by typing, by toggling category chips, and (on Active) by toggling Bought/Unbought
- Old archived items disappear automatically after 90 days; no operator intervention or UI surface needed
- Members can mark items as recurring (daily / weekly / monthly) and the system maintains them on the active list, skipping duplicates

---

## Decisions locked in (from brainstorming)

| Topic | Choice |
|---|---|
| Auto-prune target | Hard-delete archived items 90 days after `archivedAt`. Active items never affected. |
| Auto-prune mechanism | MongoDB TTL index with partial filter. No cron, no UI surface. |
| Retention | Fixed 90 days, hard-coded. Not configurable per household. |
| Search field | `name` only, case-insensitive substring. Regex metacharacters in user input are escaped. |
| Search debounce | 500 ms idle before re-query. |
| Filter scope | Both Active and History tabs. |
| Filter mechanism | Server-side everywhere (single source of truth, simpler code). |
| Chips on Active | Category (multi-select) + Bought/Unbought (`'bought' | 'unbought' | 'all'`). |
| Chips on History | Category (multi-select) only. Bought/Unbought is meaningless on archived items. |
| Recurring cadences | `daily`, `weekly`, `monthly`. |
| Recurring rule fields | `name`, `category`, `cadence`, `active` (boolean). No quantity, no notes. |
| Recurring fire timing | Fixed crons: daily 06:00, weekly Mon 06:00, monthly 1st 06:00. |
| Recurring dedupe | Skip if an active `ShoppingListItem` exists in the same household with same case-insensitive `name` and same `category`. |
| Recurring management UI | New "Recurring" tab on `ShoppingListPage` (third tab). |
| Recurring permissions | Any household member can create / edit / delete / toggle. (Couple-only; admin gate not warranted.) |

---

## Out of scope for v3 (still YAGNI)

- **Configurable retention** — 90 days is hard-coded. If a household wants a different window, that's a v4 feature.
- **Bulk select / multi-archive** — still single-row.
- **Search within `notes` field** — `name` only.
- **URL persistence of filter state** — filters are session-local component state.
- **"Make recurring" shortcut from an existing active item** — recurring rules are created via the Recurring tab only.
- **Filter chip "Recurring vs manual"** — deferred. Not enough signal to justify yet.
- **Cron-builder UI / day-of-week / day-of-month / biweekly** — only the three fixed cadences.
- **Catch-up firing** — if the cron misses (server down at 06:00), rules are not re-fired. Same behavior as recurring expenses.

---

## Architecture

```
┌──────────────────────────── Backend ─────────────────────────────┐
│  shopping-list-item.model.ts                                     │
│    └── + TTL index on archivedAt (90d, partial filter)           │
│                                                                   │
│  recurring-shopping-item.model.ts (new)                          │
│    └── { householdId, name, category, cadence, active, createdBy }│
│                                                                   │
│  shopping-list.service.ts                                        │
│    └── listItems / listArchivedHistory accept filter params      │
│                                                                   │
│  recurring-shopping-item.service.ts (new)                        │
│    ├── createRule / listRules / updateRule / deleteRule          │
│    └── fireRulesForCadence(cadence)  ──► shoppingListService.addItem
│                                                                   │
│  scheduler/recurringShoppingItems.ts (new)                       │
│    └── 3 × scheduleWithLock(...) → fireRulesForCadence(cadence)  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────── Frontend ────────────────────────────┐
│  ShoppingListPage.tsx                                            │
│    ├── Tabs: [Active | History | Recurring]                      │
│    ├── ShoppingFilterBar (above Active and History bodies)       │
│    └── Recurring tab body + AddRecurringItemForm modal           │
│                                                                   │
│  hooks/queries/useShoppingListQueries.ts                         │
│    └── filter params flow into queryKey → re-fetch on change     │
│                                                                   │
│  hooks/queries/useRecurringShoppingItemQueries.ts (new)          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Backend — Data model

### 1. `ShoppingListItem` — TTL index

Edit `BackEnd/src/models/shopping-list-item.model.ts`. Add:

```ts
schema.index(
  { archivedAt: 1 },
  {
    expireAfterSeconds: 90 * 86400,
    partialFilterExpression: { archivedAt: { $type: 'date' } },
  }
);
```

The partial filter ensures only documents where `archivedAt` is a real date are eligible. Active items (where `archivedAt` is `null` or absent) are never touched. MongoDB sweeps roughly every 60 seconds.

No new fields. No service-code changes for auto-prune.

### 2. `RecurringShoppingItem` — new model

`BackEnd/src/models/recurring-shopping-item.model.ts`:

```ts
{
  householdId: ObjectId,         // ref Household, indexed
  name: string,                  // trimmed, 1..120
  category: string,              // EXPENSE_TYPES enum, default 'groceries'
  cadence: 'daily' | 'weekly' | 'monthly',
  active: boolean,               // default true; soft-pause without delete
  createdBy: ObjectId,           // ref User
  createdAt, updatedAt           // mongoose timestamps
}
```

Indexes:
- `{ householdId: 1, active: 1, cadence: 1 }` — keeps the cron's per-cadence sweep cheap.

### 3. Types

New file `BackEnd/src/types/recurring-shopping-item.types.ts`:

- `RecurrenceCadence = 'daily' | 'weekly' | 'monthly'`
- `IRecurringShoppingItem` — plain interface
- `IRecurringShoppingItemDocument` extends `IRecurringShoppingItem & Document`
- `RecurringShoppingItemPayload` — create/update DTO (`name`, `category`, `cadence`, optional `active`)

---

## Backend — Services

### `shopping-list.service.ts` — extend list methods

`listItems(householdId, userId, opts?)` and `listArchivedHistory(householdId, userId, opts?)` accept new optional params on `opts`:

```ts
{
  search?: string;               // case-insensitive name substring
  categories?: string[];         // EXPENSE_TYPES values; multi-select
  boughtState?: 'bought' | 'unbought' | 'all';  // listItems only
}
```

Filter composition:

- `search` → `{ name: { $regex: escapeRegex(search), $options: 'i' } }`. `escapeRegex` (a small helper colocated in the service or `BackEnd/src/utils/regex.ts`) replaces regex metacharacters in user input so `"."` matches a literal dot.
- `categories` → if non-empty array, `{ category: { $in: categories } }`. Empty / undefined = no category filter.
- `boughtState` → on `listItems`: `'bought'` adds `{ bought: true }`, `'unbought'` adds `{ bought: false }`, `'all'` (default) adds nothing. On `listArchivedHistory`: ignored — every archived item is "bought" in the conversion sense or "neither" in the manual-archive sense; the chip is not shown on the History tab.

History pagination cursor logic is **unchanged**. Filters narrow the underlying query before pagination is applied.

### `recurring-shopping-item.service.ts` — new

Class singleton, mirrors the `shopping-list.service.ts` shape:

| Method | Purpose |
|---|---|
| `createRule(householdId, userId, payload)` | Verify membership; insert rule with `createdBy = userId`, `active = true` (default). |
| `listRules(householdId, userId)` | Verify membership; return all rules (active + inactive) sorted by `name`. |
| `updateRule(ruleId, householdId, userId, payload)` | Verify membership; allow editing `name` / `category` / `cadence`; allow toggling `active`. |
| `deleteRule(ruleId, householdId, userId)` | Verify membership; hard-delete the rule. |
| `fireRulesForCadence(cadence)` | Cron-only. Not exposed via HTTP. See below. |

`fireRulesForCadence(cadence)`:

1. Query `RecurringShoppingItem.find({ active: true, cadence })`.
2. Group by `householdId` for efficient batched dedupe lookups (one query per household instead of one per rule).
3. For each rule: query `ShoppingListItem.findOne({ householdId, archivedAt: { $exists: false }, name: rule.name, category: rule.category }).collation({ locale: 'en', strength: 2 })` for case-insensitive name compare.
4. If no match: call `shoppingListService.addItem(householdId, rule.createdBy, { name: rule.name, category: rule.category })`.
5. Returns `{ created: number, skipped: number }` aggregated across all rules; the scheduler logs this.

Reusing `shoppingListService.addItem` keeps the rule-evaluation logic with the rule model while ensuring any future invariants on item creation aren't bypassed.

### Authorization

All four CRUD methods on `recurring-shopping-item.service.ts` perform membership verification only (matches v2 active-item authorization). No admin gate. `fireRulesForCadence` is internal; the controller never calls it.

---

## Backend — Controllers, routes, validators

### Routes

Mounted at `/api/households/:id/shopping-list/recurring` via a new router file `BackEnd/src/routes/recurring-shopping-item.routes.ts` (with `mergeParams: true`):

| Method | Path | Action |
|--------|------|--------|
| POST   | `/api/households/:id/shopping-list/recurring`           | createRule |
| GET    | `/api/households/:id/shopping-list/recurring`           | listRules |
| PATCH  | `/api/households/:id/shopping-list/recurring/:ruleId`   | updateRule |
| DELETE | `/api/households/:id/shopping-list/recurring/:ruleId`   | deleteRule |

### Files

- `BackEnd/src/controllers/recurring-shopping-item.controller.ts` (new)
- `BackEnd/src/routes/recurring-shopping-item.routes.ts` (new) — mounted from `BackEnd/src/routes/shopping-list.routes.ts` (since the path is nested under `/shopping-list`)
- `BackEnd/src/validators/recurring-shopping-item.validators.ts` (new) — express-validator chains: `name` 1..120 trimmed string; `category` in `EXPENSE_TYPES`; `cadence` in `['daily','weekly','monthly']`; `active` optional boolean
- `BackEnd/src/controllers/shopping-list.controller.ts` — extend `listItems` / `listArchivedHistory` handlers to read query params (`search`, `categories[]`, `boughtState`) and pass through to the service
- `BackEnd/src/validators/shopping-list.validators.ts` — accept `search` (max length 120), `categories` (array of `EXPENSE_TYPES`), `boughtState` (enum) as optional query params

---

## Backend — Scheduler

New file `BackEnd/src/scheduler/recurringShoppingItems.ts`. Mirrors `recurringExpenses.ts`:

```ts
export function start() {
  scheduleWithLock(
    '0 6 * * *',
    'recurring-shopping-daily',
    () => recurringShoppingItemService.fireRulesForCadence('daily'),
    { lockTtlMs: 5 * 60 * 1000 }
  );
  scheduleWithLock(
    '0 6 * * 1',
    'recurring-shopping-weekly',
    () => recurringShoppingItemService.fireRulesForCadence('weekly'),
    { lockTtlMs: 5 * 60 * 1000 }
  );
  scheduleWithLock(
    '0 6 1 * *',
    'recurring-shopping-monthly',
    () => recurringShoppingItemService.fireRulesForCadence('monthly'),
    { lockTtlMs: 5 * 60 * 1000 }
  );
}
```

Lock TTL of 5 minutes is generous; the sweep is small. `scheduleWithLock` ensures atomic execution across replicas via the `CronLock` collection.

Wired into `BackEnd/src/index.ts` next to the existing scheduler `start()` call.

---

## Frontend — Types & API

### Types

- `FrontEnd/src/types/shoppingList.types.ts` — extend `ListItemsParams` and `ListHistoryParams` with `search?: string`, `categories?: string[]`, `boughtState?: 'bought' | 'unbought' | 'all'`
- `FrontEnd/src/types/recurringShoppingItem.types.ts` (new) — `RecurrenceCadence`, `IRecurringShoppingItem`, `RecurringShoppingItemPayload`, response types

### API

- `FrontEnd/src/api/shoppingList.api.ts` — `listItems` / `listHistory` serialize new params into the query string. `categories` is sent as repeated `categories=foo&categories=bar` to match express-validator array parsing.
- `FrontEnd/src/api/recurringShoppingItem.api.ts` (new) — `createRule`, `listRules`, `updateRule`, `deleteRule` axios calls

### Hooks

- `FrontEnd/src/hooks/queries/useShoppingListQueries.ts` — `useListItems` and `useArchivedHistory` accept a filter param object. The filter object is included in the `queryKey` so TanStack Query re-fetches and (for the infinite query) resets to page 1 when the filter changes.
- `FrontEnd/src/hooks/queries/useRecurringShoppingItemQueries.ts` (new) — `useRecurringRules`, `useCreateRule`, `useUpdateRule`, `useDeleteRule`. Mutations invalidate the rules list query.

---

## Frontend — UI

### `ShoppingFilterBar.tsx` — new shared component

Path: `FrontEnd/src/components/dashboard/shared/ShoppingFilterBar.tsx`.

Layout:

```
┌──────────────────────────────────────────────────────┐
│  🔍  [ Search items...                    ]          │
│  ⦿ Groceries  ○ Cleaning  ○ Toiletries  ○ Other ...   │
│  [ All  Bought  Unbought ]   ← Active tab only       │
└──────────────────────────────────────────────────────┘
```

- Top row: `<Input>` with magnifier icon prefix. `onChange` debounced via a small `useDebouncedValue(value, 500)` hook (new — add at `FrontEnd/src/hooks/useDebouncedValue.ts`; ~10-line `useEffect` + `setTimeout` implementation). Local state updates immediately (so the input feels snappy); the debounced value flows up via `onSearchChange` to the parent.
- Middle row: horizontally-scrolling chip row using `<Badge>` components. Filled = selected, outlined = unselected. Click toggles. Multi-select.
- Bottom row (conditional): three-segment toggle for Bought/Unbought/All. Rendered only when `boughtState` and `onBoughtStateChange` props are both provided.

Props:

```ts
{
  search: string;
  onSearchChange: (s: string) => void;
  selectedCategories: string[];
  onToggleCategory: (cat: string) => void;
  boughtState?: 'bought' | 'unbought' | 'all';
  onBoughtStateChange?: (s: 'bought' | 'unbought' | 'all') => void;
}
```

### `ShoppingListPage.tsx` — wire the bar + add Recurring tab

- Filter state lives on the page: `const [search, setSearch] = useState('')`, `const [categories, setCategories] = useState<string[]>([])`, `const [boughtState, setBoughtState] = useState<'all'|'bought'|'unbought'>('all')`.
- `<ShoppingFilterBar>` is rendered above `<ShoppingListView>` (Active tab) and above the `<ShoppingHistoryView>` body (History tab). The Active instance passes `boughtState` props; the History instance does not.
- Filter state is **session-local** (no URL sync). It does **not** reset when switching tabs — typing "milk" on Active and switching to History keeps `search = 'milk'` so cross-tab searches feel continuous.
- Tabs become `[Active | History | Recurring]`.

### Recurring tab

- Body: a vertical list of recurring rules. Each row renders:
  - `name` (text)
  - category badge (existing pattern from `ShoppingListView`)
  - cadence badge (e.g., "Weekly")
  - `<Switch>` for `active` (calls `useUpdateRule` with `{ active: !current }`)
  - pencil icon → opens `AddRecurringItemForm` in edit mode
  - trash icon → `useDeleteRule` with confirm
- Empty state: "No recurring items yet" + a primary "Add recurring item" button.
- Top-right primary action when list is non-empty: "Add recurring item" button.

### `AddRecurringItemForm.tsx` — new modal

Path: `FrontEnd/src/components/dashboard/shared/AddRecurringItemForm.tsx`.

Mirrors `AddShoppingItemForm` shape (single dialog used for both create and edit via an optional `rule?` prop). Fields:

- `name` (text input, required)
- `category` (`<Select>` with `EXPENSE_TYPES`, default `groceries`)
- `cadence` (`<Select>` with `daily / weekly / monthly`, default `weekly`)

Submit calls `useCreateRule` or `useUpdateRule` based on whether `rule` was passed. Active toggle is not on the form — it's on the row's `<Switch>`.

---

## Critical files to modify

**Backend**
- `BackEnd/src/models/shopping-list-item.model.ts` — add TTL index
- `BackEnd/src/models/recurring-shopping-item.model.ts` (new)
- `BackEnd/src/types/recurring-shopping-item.types.ts` (new)
- `BackEnd/src/services/shopping-list.service.ts` — extend `listItems` + `listArchivedHistory`
- `BackEnd/src/services/recurring-shopping-item.service.ts` (new)
- `BackEnd/src/controllers/shopping-list.controller.ts` — pass new query params through
- `BackEnd/src/controllers/recurring-shopping-item.controller.ts` (new)
- `BackEnd/src/routes/recurring-shopping-item.routes.ts` (new) + mount from `shopping-list.routes.ts`
- `BackEnd/src/validators/shopping-list.validators.ts` — accept new query params
- `BackEnd/src/validators/recurring-shopping-item.validators.ts` (new)
- `BackEnd/src/scheduler/recurringShoppingItems.ts` (new)
- `BackEnd/src/index.ts` — wire new scheduler

**Frontend**
- `FrontEnd/src/types/shoppingList.types.ts` — extend list params
- `FrontEnd/src/types/recurringShoppingItem.types.ts` (new)
- `FrontEnd/src/api/shoppingList.api.ts` — extend list calls
- `FrontEnd/src/api/recurringShoppingItem.api.ts` (new)
- `FrontEnd/src/hooks/queries/useShoppingListQueries.ts` — accept filter params
- `FrontEnd/src/hooks/queries/useRecurringShoppingItemQueries.ts` (new)
- `FrontEnd/src/components/dashboard/shared/ShoppingFilterBar.tsx` (new)
- `FrontEnd/src/components/dashboard/shared/AddRecurringItemForm.tsx` (new)
- `FrontEnd/src/hooks/useDebouncedValue.ts` (new) — generic `useDebouncedValue<T>(value, delayMs): T` hook
- `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx` — add Recurring tab + filter bar wiring

---

## Reused functions / utilities

- `scheduleWithLock(cronExpression, lockName, job, options)` — `BackEnd/src/scheduler/cronLock.ts`
- `CronLock` model (TTL pattern reference) — `BackEnd/src/models/cron-lock.model.ts`
- `shoppingListService.addItem(...)` — called from `fireRulesForCadence` so item-creation invariants are preserved
- `EXPENSE_TYPES` enum — already used by v2, reused unchanged
- shadcn `<Input>`, `<Badge>`, `<Switch>`, `<Select>`, `<Tabs>` — all already in the design system

---

## Verification plan

### Backend

- Existing test suite (`cd BackEnd && npm test`) stays green
- New unit tests:
  - `shopping-list.service.test.ts` (extend) — search + categories + boughtState combinations on Active and History; verify regex metacharacters in `search` are escaped (e.g., `"."` matches a literal dot, not "any char")
  - `recurring-shopping-item.service.test.ts` (new) — CRUD; `fireRulesForCadence` dedupe (case-insensitive name + same category); inactive rules are skipped; rule fires across multiple households independently
- Manual recurring fire: connect to dev DB with a test household; insert a `RecurringShoppingItem` with cadence `daily`; invoke `recurringShoppingItemService.fireRulesForCadence('daily')` from a script (`ts-node`); verify the item appears on the active list; run twice — confirm second run skips (dedupe)
- Manual TTL: insert a `ShoppingListItem` with `archivedAt` set to 91 days ago; wait ~60 s; verify it disappears. Alternatively, drop and recreate the index with `expireAfterSeconds: 60` for a faster local check; restore the 90-day setting before commit

### Frontend

- `cd FrontEnd && npm run dev`
- Search box: type "mil" — verify a single re-query fires 500 ms after the last keystroke (DevTools Network tab shows one `GET /shopping-list?search=mil`)
- Category chips on Active: toggle multi-select; verify each toggle re-queries
- Category chips on History: same; verify pagination resets to page 1 (cursor cleared)
- Bought/Unbought on Active: toggle each segment; verify chip is **absent** on History tab
- Recurring tab: empty state → add a rule → edit it → toggle active off and on → delete it
- Cross-tab persistence: type "milk" on Active, switch to History — search box still reads "milk" and History query uses that filter

### End-to-end smoke

- Create a recurring rule "Milk" / `groceries` / `weekly`
- Manually trigger `fireRulesForCadence('weekly')`
- Verify "Milk" appears on Active
- Fire again — verify no duplicate (skipped)
- Buy and archive "Milk", then fire again — verify a new "Milk" is created (only **active** items dedupe; archived items don't block)
- Archive an item with a backdated `archivedAt` and confirm TTL deletion path

---
