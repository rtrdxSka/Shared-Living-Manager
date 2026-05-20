# Shopping List v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side search + chip filters (Active and History tabs), MongoDB-TTL-based 90-day auto-prune of archived items, and recurring shopping items (daily / weekly / monthly cron-driven dedupe-aware) to the existing v2 shopping list.

**Architecture:** Three additive feature slices on top of v2. Auto-prune is one schema-level TTL index, no service code. Search/filter extends two existing service methods to accept three new optional params (`search`, `categories`, `boughtState`) and threads them through controller + validators + frontend. Recurring is a fresh model + service + controller + validators + routes + a 3-cron scheduler reusing `scheduleWithLock`, plus a third "Recurring" tab and a modal in the frontend.

**Tech Stack:** Node 20 + Express + TypeScript + Mongoose, React 18 + TypeScript + Vite + TanStack Query + shadcn/ui. Backend uses `node-cron` via `scheduleWithLock` (atomic lock via `CronLock` collection).

**Commit policy:** The user runs `git commit` themselves; the "Stage and commit" step in each task describes the boundary and message but does not actually invoke `git commit` — it stops at staging and reports the proposed commit message for the user to run.

**Test policy:** The backend has no Jest/Vitest infrastructure (`npm test` is a stub). Verification uses manual smoke scripts written in TypeScript, executed with `npx ts-node <file>` against the dev MongoDB, and `curl` for HTTP paths. Frontend is verified by exercising `npm run dev` in a browser. Add a `BackEnd/scripts/smoke-v3.ts` file (gitignored — see Task 1) for the recurring/TTL smoke runs and reuse it across tasks.

---

## File Structure (decomposition lockdown)

### Backend — created
- `BackEnd/src/utils/regex.ts` — exports `escapeRegex(s: string): string`
- `BackEnd/src/types/recurring-shopping-item.types.ts`
- `BackEnd/src/models/recurring-shopping-item.model.ts`
- `BackEnd/src/services/recurring-shopping-item.service.ts`
- `BackEnd/src/controllers/recurring-shopping-item.controller.ts`
- `BackEnd/src/validators/recurring-shopping-item.validator.ts` (singular `.validator.ts` per project convention)
- `BackEnd/src/routes/recurring-shopping-item.routes.ts`
- `BackEnd/src/scheduler/recurringShoppingItems.ts`
- `BackEnd/scripts/smoke-v3.ts` (gitignored helper)

### Backend — modified
- `BackEnd/src/models/shopping-list-item.model.ts` — add TTL index
- `BackEnd/src/types/shopping-list.types.ts` — add `IListItemsOptions` + `IListHistoryOptions` interfaces
- `BackEnd/src/services/shopping-list.service.ts` — extend `listItems` + `listArchivedHistory` signatures
- `BackEnd/src/validators/shopping-list.validator.ts` — extend `householdIdOnlyValidation` + `historyValidation` to accept new query params
- `BackEnd/src/controllers/shopping-list.controller.ts` — read & pass through new query params
- `BackEnd/src/routes/shopping-list.routes.ts` — mount the new recurring sub-router at `/recurring`
- `BackEnd/src/index.ts` — start the new scheduler
- `BackEnd/.gitignore` — exclude `scripts/smoke-*.ts`

### Frontend — created
- `FrontEnd/src/hooks/useDebouncedValue.ts`
- `FrontEnd/src/types/recurringShoppingItem.types.ts`
- `FrontEnd/src/api/recurringShoppingItem.api.ts`
- `FrontEnd/src/hooks/queries/useRecurringShoppingItemQueries.ts`
- `FrontEnd/src/components/dashboard/shared/ShoppingFilterBar.tsx`
- `FrontEnd/src/components/dashboard/shared/AddRecurringItemForm.tsx`

### Frontend — modified
- `FrontEnd/src/types/shoppingList.types.ts` — add `ShoppingListFilter`, `BoughtState` types
- `FrontEnd/src/api/shoppingList.api.ts` — `listItems` + `listArchivedHistory` accept filter params
- `FrontEnd/src/lib/queryKeys.ts` — add `recurring` key + `list/history` keys take filter
- `FrontEnd/src/hooks/queries/useShoppingListQueries.ts` — `useShoppingList` + `useArchivedHistory` accept filter
- `FrontEnd/src/hooks/queries/index.ts` (if it re-exports) — re-export new hooks
- `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx` — third tab + filter bar wiring

---

## Task 1: Prerequisite — gitignore the smoke scripts directory

**Files:**
- Modify: `BackEnd/.gitignore`

- [ ] **Step 1: Append exclusion to `.gitignore`**

Append the following two lines (preceded by a blank line) to `BackEnd/.gitignore`:

```
# Local manual smoke scripts (not part of any test suite)
scripts/smoke-*.ts
```

- [ ] **Step 2: Verify**

Run: `cd BackEnd && git check-ignore -v scripts/smoke-v3.ts`

Expected: prints `.gitignore:N:scripts/smoke-*.ts  scripts/smoke-v3.ts`.

- [ ] **Step 3: Stage and commit (user)**

Stage `BackEnd/.gitignore`. Proposed commit message:

```
chore: ignore local smoke-test scripts in BackEnd/scripts
```

---

## Task 2: Backend — add TTL index for archived shopping list items (auto-prune)

**Files:**
- Modify: `BackEnd/src/models/shopping-list-item.model.ts`

- [ ] **Step 1: Add the TTL index**

Open `BackEnd/src/models/shopping-list-item.model.ts`. After the existing three index lines (around line 49–51), append:

```ts
// Auto-prune archived items 90 days after archivedAt (Mongo TTL monitor sweeps ~every 60s).
// Partial filter ensures only docs with a real archivedAt are eligible — active items are never affected.
shoppingListItemSchema.index(
  { archivedAt: 1 },
  {
    expireAfterSeconds: 90 * 86400,
    partialFilterExpression: { archivedAt: { $type: 'date' } },
  }
);
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Manually verify the index is created on dev DB**

Boot the backend (`cd BackEnd && npm run dev`), then in another shell connect to the dev DB:

```bash
mongosh "$MONGODB_URI" --eval 'db.shoppinglistitems.getIndexes()'
```

Expected: an entry with `key: { archivedAt: 1 }`, `expireAfterSeconds: 7776000`, and `partialFilterExpression: { archivedAt: { $type: "date" } }`. Stop the dev server when verified.

> **If the partial filter or `expireAfterSeconds` differs**, MongoDB created the index with old options. Drop the existing `archivedAt_1` index manually (`db.shoppinglistitems.dropIndex('archivedAt_1')`) and restart the dev server so Mongoose re-creates it with the new options.

- [ ] **Step 4: Stage and commit (user)**

Stage `BackEnd/src/models/shopping-list-item.model.ts`. Proposed commit message:

```
feat(shopping-list): TTL-prune archived items after 90 days
```

---

## Task 3: Backend — `escapeRegex` utility

**Files:**
- Create: `BackEnd/src/utils/regex.ts`

- [ ] **Step 1: Create the utility**

Create `BackEnd/src/utils/regex.ts` with:

```ts
// Escape user input so it can be safely embedded in a MongoDB $regex filter.
// Without this, characters like `.`, `*`, `(`, `[` would be interpreted as regex
// metacharacters and either match too broadly or throw a SyntaxError.
const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(input: string): string {
  return input.replace(REGEX_METACHARS, '\\$&');
}
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Manually verify**

Run a one-liner to confirm escaping behaviour:

```bash
cd BackEnd && npx ts-node -e "import {escapeRegex} from './src/utils/regex'; console.log(escapeRegex('a.b*c+d?'));"
```

Expected: `a\.b\*c\+d\?`.

- [ ] **Step 4: Stage and commit (user)**

Stage `BackEnd/src/utils/regex.ts`. Proposed commit message:

```
feat(utils): add escapeRegex helper for safe $regex composition
```

---

## Task 4: Backend — extend shopping-list types with filter shapes

**Files:**
- Modify: `BackEnd/src/types/shopping-list.types.ts`

- [ ] **Step 1: Add filter type shapes**

Open `BackEnd/src/types/shopping-list.types.ts`. After the existing `IListHistoryInput` block (around line 44), append:

```ts
export type BoughtState = 'bought' | 'unbought' | 'all';

export interface IListItemsOptions {
  archived?: boolean;
  search?: string;
  categories?: ExpenseType[];
  boughtState?: BoughtState;
}

export interface IListHistoryOptions {
  cursor?: string;
  limit?: number;
  search?: string;
  categories?: ExpenseType[];
}
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors (the service/controller still use the inline `{ archived?: boolean }` shape until Task 5).

- [ ] **Step 3: Stage and commit (user)**

Stage `BackEnd/src/types/shopping-list.types.ts`. Proposed commit message:

```
feat(shopping-list): add filter option types for list + history
```

---

## Task 5: Backend — extend `listItems` and `listArchivedHistory` with filter logic

**Files:**
- Modify: `BackEnd/src/services/shopping-list.service.ts`

- [ ] **Step 1: Add the import for `escapeRegex` and update the new option types**

At the top of `BackEnd/src/services/shopping-list.service.ts`, add to the existing imports from `../types/shopping-list.types`:

```ts
import {
  IShoppingListItem,
  IAddShoppingItemInput,
  IUpdateShoppingItemInput,
  IShoppingListItemResponse,
  HistoryEntry,
  IListHistoryResult,
  IListItemsOptions,
  IListHistoryOptions,
} from '../types/shopping-list.types';
```

And add a separate import line below the existing imports:

```ts
import { escapeRegex } from '../utils/regex';
```

- [ ] **Step 2: Replace the `listItems` signature and body**

Replace the existing `listItems` method (currently lines 35–67) with:

```ts
async listItems(
  householdId: string,
  userId: string,
  options: IListItemsOptions = {}
): Promise<{ items: IShoppingListItemResponse[] }> {
  const { household } = await getHouseholdForMember(householdId, userId);

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
  // 'all' (or undefined) → no isBought filter.

  const items = await ShoppingListItem.find(query)
    .sort({ isBought: 1, createdAt: -1 })
    .lean();

  const memberMap = new Map<string, string>();
  for (const m of household.members) {
    memberMap.set(m._id.toString(), m.nickname);
  }

  const formatted = items.map((item) => {
    const boughtByMemberId = item.boughtByMemberId?.toString();
    const boughtByNickname = boughtByMemberId
      ? memberMap.get(boughtByMemberId)
      : undefined;
    return this.formatLeanResponse(item, boughtByNickname);
  });

  return { items: formatted };
}
```

- [ ] **Step 3: Replace the `listArchivedHistory` signature and body**

Replace the existing `listArchivedHistory` method (currently around lines 201–265) with:

```ts
async listArchivedHistory(
  householdId: string,
  userId: string,
  options: IListHistoryOptions = {}
): Promise<IListHistoryResult> {
  const { household } = await getHouseholdForMember(householdId, userId);
  const limit = options.limit ?? 10;

  const archivedFilter: Record<string, unknown> = {
    householdId: household._id,
    archivedAt: { $ne: null },
  };
  if (options.cursor) {
    archivedFilter.archivedAt = { $ne: null, $lt: new Date(options.cursor) };
  }

  if (options.search && options.search.trim().length > 0) {
    archivedFilter.name = { $regex: escapeRegex(options.search.trim()), $options: 'i' };
  }

  if (options.categories && options.categories.length > 0) {
    archivedFilter.category = { $in: options.categories };
  }

  const items = await ShoppingListItem.find(archivedFilter)
    .sort({ archivedAt: -1 })
    .lean();

  const memberMap = new Map<string, string>();
  for (const m of household.members) {
    memberMap.set(m._id.toString(), m.nickname);
  }

  const entries: HistoryEntry[] = [];
  const tripGroups = new Map<string, HistoryEntry & { type: 'trip' }>();

  for (const item of items) {
    const boughtByMemberId = item.boughtByMemberId?.toString();
    const boughtByNickname = boughtByMemberId ? memberMap.get(boughtByMemberId) : undefined;
    const formatted = this.formatLeanResponse(item, boughtByNickname);

    if (item.archivedExpenseId) {
      const key = item.archivedExpenseId.toString();
      if (tripGroups.has(key)) {
        tripGroups.get(key)!.items.push(formatted);
      } else {
        const tripEntry: HistoryEntry & { type: 'trip' } = {
          type: 'trip',
          archivedAt: item.archivedAt!.toISOString(),
          items: [formatted],
          expenseId: key,
          dominantCategory: (item.archivedDominantCategory ?? item.category) as ExpenseType,
        };
        tripGroups.set(key, tripEntry);
        entries.push(tripEntry);
      }
    } else {
      entries.push({
        type: 'manual',
        archivedAt: item.archivedAt!.toISOString(),
        items: [formatted],
      });
    }

    if (entries.length > limit) break;
  }

  const pageEntries = entries.slice(0, limit);
  const hasMore = entries.length > limit;
  const nextCursor = hasMore ? pageEntries[pageEntries.length - 1].archivedAt : null;

  return { entries: pageEntries, nextCursor };
}
```

- [ ] **Step 4: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: errors in `shopping-list.controller.ts` because the controller still calls the old signatures. That's expected — Task 7 fixes the controller.

- [ ] **Step 5: Stage and commit (user)**

Stage `BackEnd/src/services/shopping-list.service.ts`. Proposed commit message:

```
feat(shopping-list): support search/categories/boughtState filters in list + history
```

---

## Task 6: Backend — extend validators for the new query params

**Files:**
- Modify: `BackEnd/src/validators/shopping-list.validator.ts`

- [ ] **Step 1: Replace `householdIdOnlyValidation` and `historyValidation`**

Open `BackEnd/src/validators/shopping-list.validator.ts`. Replace the two named exports `householdIdOnlyValidation` (currently around lines 83–87) and `historyValidation` (currently around lines 103–117) with:

```ts
export const householdIdOnlyValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ max: 120 })
    .withMessage('Search cannot exceed 120 characters'),

  query('categories')
    .optional()
    .toArray()
    .custom((value: unknown) => {
      if (!Array.isArray(value)) return false;
      return value.every((v) => typeof v === 'string' && EXPENSE_TYPE_VALUES.includes(v as typeof EXPENSE_TYPE_VALUES[number]));
    })
    .withMessage('Each category must be a valid expense type'),

  query('boughtState')
    .optional()
    .isIn(['bought', 'unbought', 'all'])
    .withMessage('boughtState must be one of: bought, unbought, all'),
];

export const historyValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  query('cursor')
    .optional()
    .isISO8601()
    .withMessage('Cursor must be an ISO 8601 date'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ max: 120 })
    .withMessage('Search cannot exceed 120 characters'),

  query('categories')
    .optional()
    .toArray()
    .custom((value: unknown) => {
      if (!Array.isArray(value)) return false;
      return value.every((v) => typeof v === 'string' && EXPENSE_TYPE_VALUES.includes(v as typeof EXPENSE_TYPE_VALUES[number]));
    })
    .withMessage('Each category must be a valid expense type'),
];
```

> Note: `.toArray()` from express-validator coerces a single string value into a one-element array, so requests like `?categories=groceries` and `?categories=groceries&categories=cleaning` both validate.

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: same controller errors as Task 5; no new errors in this file.

- [ ] **Step 3: Stage and commit (user)**

Stage `BackEnd/src/validators/shopping-list.validator.ts`. Proposed commit message:

```
feat(shopping-list): validate new search/categories/boughtState query params
```

---

## Task 7: Backend — pass new query params through controllers

**Files:**
- Modify: `BackEnd/src/controllers/shopping-list.controller.ts`

- [ ] **Step 1: Add an import**

At the top of `BackEnd/src/controllers/shopping-list.controller.ts`, add to the existing types import:

```ts
import {
  IAddShoppingItemInput,
  IUpdateShoppingItemInput,
  IArchiveBoughtInput,
  BoughtState,
} from '../types/shopping-list.types';
import type { ExpenseType } from '../types/household.types';
```

- [ ] **Step 2: Add a small helper inside the class**

Inside `class ShoppingListController` (above `addItem`), add:

```ts
private parseFilterQuery(req: AuthRequest): {
  search?: string;
  categories?: ExpenseType[];
  boughtState?: BoughtState;
} {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  let categories: ExpenseType[] | undefined;
  if (Array.isArray(req.query.categories)) {
    categories = req.query.categories.filter((v): v is string => typeof v === 'string') as ExpenseType[];
  } else if (typeof req.query.categories === 'string') {
    categories = [req.query.categories as ExpenseType];
  }

  const boughtState =
    req.query.boughtState === 'bought' || req.query.boughtState === 'unbought' || req.query.boughtState === 'all'
      ? (req.query.boughtState as BoughtState)
      : undefined;

  return { search, categories, boughtState };
}
```

- [ ] **Step 3: Replace `listItems` and `listArchivedHistory`**

Replace `listItems` (lines 28–41) with:

```ts
// GET /api/households/:id/shopping-list
async listItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const householdId = req.params.id as string;
    const archived = req.query.archived === 'true';
    const { search, categories, boughtState } = this.parseFilterQuery(req);
    const result = await shoppingListService.listItems(householdId, req.user.userId, {
      archived,
      search,
      categories,
      boughtState,
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}
```

Replace `listArchivedHistory` (lines 146–165) with:

```ts
// GET /api/households/:id/shopping-list/history
async listArchivedHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    const householdId = req.params.id as string;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const { search, categories } = this.parseFilterQuery(req);
    const result = await shoppingListService.listArchivedHistory(
      householdId,
      req.user.userId,
      { cursor, limit, search, categories }
    );
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Manually verify via curl**

Boot the dev server (`cd BackEnd && npm run dev`). With a valid auth cookie/token (use the frontend to log in, then copy the JWT cookie), exercise:

```bash
# Replace HID and TOKEN
HID=<household-id>
TOKEN=<jwt-cookie>

# Plain list (existing behavior)
curl -s -H "Cookie: accessToken=$TOKEN" "http://localhost:5000/api/households/$HID/shopping-list" | jq '.data.items | length'

# Search
curl -s -H "Cookie: accessToken=$TOKEN" "http://localhost:5000/api/households/$HID/shopping-list?search=milk" | jq '.data.items | map(.name)'

# Category filter
curl -s -H "Cookie: accessToken=$TOKEN" "http://localhost:5000/api/households/$HID/shopping-list?categories=groceries&categories=cleaning" | jq '.data.items | map(.category) | unique'

# Bought state
curl -s -H "Cookie: accessToken=$TOKEN" "http://localhost:5000/api/households/$HID/shopping-list?boughtState=unbought" | jq '.data.items | map(.isBought) | unique'

# Regex escape: searching for "." should NOT match every name
curl -s -H "Cookie: accessToken=$TOKEN" "http://localhost:5000/api/households/$HID/shopping-list?search=." | jq '.data.items | length'

# Same for history
curl -s -H "Cookie: accessToken=$TOKEN" "http://localhost:5000/api/households/$HID/shopping-list/history?search=milk" | jq '.data.entries | length'
```

Expected:
- Plain list returns the same count as before
- Search collapses results to matching `name`s
- Category filter returns only the requested categories
- `boughtState=unbought` returns only `isBought: false` items (`unique` should be `[false]`)
- `search=.` should match items containing a literal `.` in the name (often `0` if no items have a dot) — NOT every item
- History search returns only matching trips

Stop the dev server when done.

- [ ] **Step 6: Stage and commit (user)**

Stage `BackEnd/src/controllers/shopping-list.controller.ts`. Proposed commit message:

```
feat(shopping-list): wire search/categories/boughtState query params through controller
```

---

## Task 8: Backend — `RecurringShoppingItem` types

**Files:**
- Create: `BackEnd/src/types/recurring-shopping-item.types.ts`

- [ ] **Step 1: Create the types file**

Create `BackEnd/src/types/recurring-shopping-item.types.ts` with:

```ts
import { Document, Types } from 'mongoose';
import { ExpenseType } from './household.types';

export type RecurrenceCadence = 'daily' | 'weekly' | 'monthly';

export interface IRecurringShoppingItem extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecurringShoppingItemPayload {
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active?: boolean;
}

export interface IRecurringShoppingItemResponse {
  _id: string;
  householdId: string;
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IFireRulesResult {
  created: number;
  skipped: number;
}
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage `BackEnd/src/types/recurring-shopping-item.types.ts`. Proposed commit message:

```
feat(types): add RecurringShoppingItem types
```

---

## Task 9: Backend — `RecurringShoppingItem` model

**Files:**
- Create: `BackEnd/src/models/recurring-shopping-item.model.ts`

- [ ] **Step 1: Create the model file**

Create `BackEnd/src/models/recurring-shopping-item.model.ts` with:

```ts
import { Schema, model } from 'mongoose';
import { IRecurringShoppingItem } from '../types/recurring-shopping-item.types';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

const CADENCE_VALUES = ['daily', 'weekly', 'monthly'] as const;

const recurringShoppingItemSchema = new Schema<IRecurringShoppingItem>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    category: {
      type: String,
      enum: EXPENSE_TYPE_VALUES,
      required: true,
      default: 'groceries',
    },
    cadence: {
      type: String,
      enum: CADENCE_VALUES,
      required: true,
    },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index — keeps the cron's per-cadence sweep cheap.
recurringShoppingItemSchema.index({ householdId: 1, active: 1, cadence: 1 });

export const RecurringShoppingItem = model<IRecurringShoppingItem>(
  'RecurringShoppingItem',
  recurringShoppingItemSchema
);
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage `BackEnd/src/models/recurring-shopping-item.model.ts`. Proposed commit message:

```
feat(models): add RecurringShoppingItem model
```

---

## Task 10: Backend — `recurring-shopping-item.service` (CRUD methods)

**Files:**
- Create: `BackEnd/src/services/recurring-shopping-item.service.ts`

- [ ] **Step 1: Scaffold the service with CRUD only (no `fireRulesForCadence` yet)**

Create `BackEnd/src/services/recurring-shopping-item.service.ts` with:

```ts
import { Types } from 'mongoose';
import { RecurringShoppingItem } from '../models/recurring-shopping-item.model';
import {
  IRecurringShoppingItem,
  IRecurringShoppingItemPayload,
  IRecurringShoppingItemResponse,
  IFireRulesResult,
  RecurrenceCadence,
} from '../types/recurring-shopping-item.types';
import { NotFoundError } from '../utils/error';
import { getHouseholdForMember } from '../utils/household.helpers';

class RecurringShoppingItemService {
  async createRule(
    householdId: string,
    userId: string,
    payload: IRecurringShoppingItemPayload
  ): Promise<IRecurringShoppingItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.create({
      householdId: household._id,
      name: payload.name.trim(),
      category: payload.category,
      cadence: payload.cadence,
      active: payload.active ?? true,
      createdBy: userId,
    });

    return this.formatResponse(rule);
  }

  async listRules(
    householdId: string,
    userId: string
  ): Promise<{ rules: IRecurringShoppingItemResponse[] }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const rules = await RecurringShoppingItem.find({ householdId: household._id })
      .sort({ name: 1 })
      .lean();

    const formatted = rules.map((r) => this.formatLeanResponse(r));
    return { rules: formatted };
  }

  async updateRule(
    ruleId: string,
    householdId: string,
    userId: string,
    payload: Partial<IRecurringShoppingItemPayload>
  ): Promise<IRecurringShoppingItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.findOne({
      _id: ruleId,
      householdId: household._id,
    });
    if (!rule) throw NotFoundError('Recurring shopping rule not found');

    if (payload.name !== undefined) rule.name = payload.name.trim();
    if (payload.category !== undefined) rule.category = payload.category;
    if (payload.cadence !== undefined) rule.cadence = payload.cadence;
    if (payload.active !== undefined) rule.active = payload.active;

    await rule.save();
    return this.formatResponse(rule);
  }

  async deleteRule(
    ruleId: string,
    householdId: string,
    userId: string
  ): Promise<void> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.findOne({
      _id: ruleId,
      householdId: household._id,
    });
    if (!rule) throw NotFoundError('Recurring shopping rule not found');

    await rule.deleteOne();
  }

  // fireRulesForCadence is added in Task 11.

  private formatResponse(rule: IRecurringShoppingItem): IRecurringShoppingItemResponse {
    return {
      _id: rule._id.toString(),
      householdId: rule.householdId.toString(),
      name: rule.name,
      category: rule.category,
      cadence: rule.cadence,
      active: rule.active,
      createdBy: rule.createdBy.toString(),
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  private formatLeanResponse(rule: {
    _id: Types.ObjectId;
    householdId: Types.ObjectId;
    name: string;
    category: IRecurringShoppingItem['category'];
    cadence: RecurrenceCadence;
    active: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }): IRecurringShoppingItemResponse {
    return {
      _id: rule._id.toString(),
      householdId: rule.householdId.toString(),
      name: rule.name,
      category: rule.category,
      cadence: rule.cadence,
      active: rule.active,
      createdBy: rule.createdBy.toString(),
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}

export const recurringShoppingItemService = new RecurringShoppingItemService();

// Re-export the result type so the scheduler can import it from one place.
export type { IFireRulesResult };
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new service file. Proposed commit message:

```
feat(shopping-list): add RecurringShoppingItem service CRUD
```

---

## Task 11: Backend — add `fireRulesForCadence` to the service

**Files:**
- Modify: `BackEnd/src/services/recurring-shopping-item.service.ts`

- [ ] **Step 1: Add the import for `shoppingListService`**

At the top of `BackEnd/src/services/recurring-shopping-item.service.ts`, add:

```ts
import { ShoppingListItem } from '../models/shopping-list-item.model';
import { shoppingListService } from './shopping-list.service';
import { logger } from '../utils/logger';
```

- [ ] **Step 2: Insert the `fireRulesForCadence` method**

Inside the `RecurringShoppingItemService` class, before the `private formatResponse` line, insert:

```ts
async fireRulesForCadence(cadence: RecurrenceCadence): Promise<IFireRulesResult> {
  const rules = await RecurringShoppingItem.find({ active: true, cadence }).lean();

  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    // Case-insensitive name + same category + active (not archived) match in the same household.
    const existing = await ShoppingListItem.findOne({
      householdId: rule.householdId,
      archivedAt: { $exists: false },
      name: rule.name,
      category: rule.category,
    })
      .collation({ locale: 'en', strength: 2 })
      .lean();

    if (existing) {
      skipped++;
      continue;
    }

    try {
      await shoppingListService.addItem(
        rule.householdId.toString(),
        rule.createdBy.toString(),
        { name: rule.name, category: rule.category }
      );
      created++;
    } catch (err) {
      // Don't let a single bad rule (e.g. household deleted) abort the whole sweep.
      logger.error(
        { err, ruleId: rule._id.toString(), cadence },
        '[RecurringShoppingItem] Failed to materialize rule'
      );
    }
  }

  return { created, skipped };
}
```

- [ ] **Step 3: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Stage and commit (user)**

Stage `BackEnd/src/services/recurring-shopping-item.service.ts`. Proposed commit message:

```
feat(shopping-list): fireRulesForCadence creates active items, dedupes by name+category
```

---

## Task 12: Backend — `recurring-shopping-item.controller`

**Files:**
- Create: `BackEnd/src/controllers/recurring-shopping-item.controller.ts`

- [ ] **Step 1: Create the controller**

Create `BackEnd/src/controllers/recurring-shopping-item.controller.ts` with:

```ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recurringShoppingItemService } from '../services/recurring-shopping-item.service';
import { IRecurringShoppingItemPayload } from '../types/recurring-shopping-item.types';

class RecurringShoppingItemController {
  // POST /api/households/:id/shopping-list/recurring
  async createRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const payload = req.body as IRecurringShoppingItemPayload;
      const rule = await recurringShoppingItemService.createRule(householdId, req.user.userId, payload);
      res.status(201).json({ status: 'success', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/shopping-list/recurring
  async listRules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const result = await recurringShoppingItemService.listRules(householdId, req.user.userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/shopping-list/recurring/:ruleId
  async updateRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const ruleId = req.params.ruleId as string;
      const payload = req.body as Partial<IRecurringShoppingItemPayload>;
      const rule = await recurringShoppingItemService.updateRule(
        ruleId,
        householdId,
        req.user.userId,
        payload
      );
      res.status(200).json({ status: 'success', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/shopping-list/recurring/:ruleId
  async deleteRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const ruleId = req.params.ruleId as string;
      await recurringShoppingItemService.deleteRule(ruleId, householdId, req.user.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const recurringShoppingItemController = new RecurringShoppingItemController();
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new controller file. Proposed commit message:

```
feat(shopping-list): add RecurringShoppingItem controller
```

---

## Task 13: Backend — `recurring-shopping-item.validator`

**Files:**
- Create: `BackEnd/src/validators/recurring-shopping-item.validator.ts`

- [ ] **Step 1: Create the validator file**

Create `BackEnd/src/validators/recurring-shopping-item.validator.ts` with:

```ts
import { body, param, ValidationChain } from 'express-validator';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

const CADENCE_VALUES = ['daily', 'weekly', 'monthly'] as const;

export const householdIdParamValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),
];

export const ruleIdParamValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('ruleId')
    .isMongoId()
    .withMessage('Invalid rule ID'),
];

export const createRuleValidation: ValidationChain[] = [
  ...householdIdParamValidation,

  body('name')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Name must be between 1 and 120 characters'),

  body('category')
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),

  body('cadence')
    .isIn(CADENCE_VALUES)
    .withMessage('Cadence must be one of: daily, weekly, monthly'),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('active must be a boolean'),
];

export const updateRuleValidation: ValidationChain[] = [
  ...ruleIdParamValidation,

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Name must be between 1 and 120 characters'),

  body('category')
    .optional()
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),

  body('cadence')
    .optional()
    .isIn(CADENCE_VALUES)
    .withMessage('Cadence must be one of: daily, weekly, monthly'),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('active must be a boolean'),
];
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new validator file. Proposed commit message:

```
feat(shopping-list): add RecurringShoppingItem validators
```

---

## Task 14: Backend — `recurring-shopping-item.routes` and mount under `/shopping-list/recurring`

**Files:**
- Create: `BackEnd/src/routes/recurring-shopping-item.routes.ts`
- Modify: `BackEnd/src/routes/shopping-list.routes.ts`

- [ ] **Step 1: Create the new router**

Create `BackEnd/src/routes/recurring-shopping-item.routes.ts` with:

```ts
import { Router } from 'express';
import { recurringShoppingItemController } from '../controllers/recurring-shopping-item.controller';
import {
  householdIdParamValidation,
  ruleIdParamValidation,
  createRuleValidation,
  updateRuleValidation,
} from '../validators/recurring-shopping-item.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// POST /api/households/:id/shopping-list/recurring
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  createRuleValidation,
  handleValidationErrors,
  recurringShoppingItemController.createRule.bind(recurringShoppingItemController)
);

// GET /api/households/:id/shopping-list/recurring
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  householdIdParamValidation,
  handleValidationErrors,
  recurringShoppingItemController.listRules.bind(recurringShoppingItemController)
);

// PATCH /api/households/:id/shopping-list/recurring/:ruleId
router.patch(
  '/:ruleId',
  authMiddleware,
  emailVerifiedMiddleware,
  updateRuleValidation,
  handleValidationErrors,
  recurringShoppingItemController.updateRule.bind(recurringShoppingItemController)
);

// DELETE /api/households/:id/shopping-list/recurring/:ruleId
router.delete(
  '/:ruleId',
  authMiddleware,
  emailVerifiedMiddleware,
  ruleIdParamValidation,
  handleValidationErrors,
  recurringShoppingItemController.deleteRule.bind(recurringShoppingItemController)
);

export default router;
```

- [ ] **Step 2: Mount the new router from `shopping-list.routes.ts`**

Open `BackEnd/src/routes/shopping-list.routes.ts`. After the existing imports, add:

```ts
import recurringShoppingItemRouter from './recurring-shopping-item.routes';
```

Then immediately after `const router = Router({ mergeParams: true });` (line 14), add:

```ts
// Sub-mount recurring rules at /recurring (must come before /:itemId routes).
router.use('/recurring', recurringShoppingItemRouter);
```

> Order matters: the existing `/:itemId` routes use a path param that would otherwise capture `recurring`. Mounting before those routes prevents collision.

- [ ] **Step 3: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Manually verify route registration via curl**

Boot the dev server. With a valid auth cookie:

```bash
HID=<household-id>
TOKEN=<jwt-cookie>

# Create a rule
curl -s -X POST -H "Cookie: accessToken=$TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Milk","category":"groceries","cadence":"weekly"}' \
  "http://localhost:5000/api/households/$HID/shopping-list/recurring" | jq

# List rules
curl -s -H "Cookie: accessToken=$TOKEN" "http://localhost:5000/api/households/$HID/shopping-list/recurring" | jq '.data.rules'

# Update a rule (use the _id from the create response)
RULE_ID=<paste-rule-id>
curl -s -X PATCH -H "Cookie: accessToken=$TOKEN" -H 'Content-Type: application/json' \
  -d '{"active":false}' \
  "http://localhost:5000/api/households/$HID/shopping-list/recurring/$RULE_ID" | jq

# Delete the rule
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE -H "Cookie: accessToken=$TOKEN" \
  "http://localhost:5000/api/households/$HID/shopping-list/recurring/$RULE_ID"
```

Expected: create returns 201 with the rule; list returns the rule; update returns 200 with `active: false`; delete returns 204. Stop the dev server.

- [ ] **Step 5: Stage and commit (user)**

Stage `BackEnd/src/routes/recurring-shopping-item.routes.ts` and `BackEnd/src/routes/shopping-list.routes.ts`. Proposed commit message:

```
feat(shopping-list): mount recurring rules router under /shopping-list/recurring
```

---

## Task 15: Backend — scheduler file `recurringShoppingItems.ts`

**Files:**
- Create: `BackEnd/src/scheduler/recurringShoppingItems.ts`

- [ ] **Step 1: Create the scheduler module**

Create `BackEnd/src/scheduler/recurringShoppingItems.ts` with:

```ts
import { recurringShoppingItemService } from '../services/recurring-shopping-item.service';
import { logger } from '../utils/logger';
import { scheduleWithLock } from './cronLock';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

export function startRecurringShoppingItemScheduler(): void {
  // Daily at 06:00
  scheduleWithLock(
    '0 6 * * *',
    'recurring-shopping-daily',
    async () => {
      logger.info('[Scheduler] Firing daily recurring shopping rules...');
      const result = await recurringShoppingItemService.fireRulesForCadence('daily');
      logger.info({ result }, '[Scheduler] Daily recurring shopping fire complete');
    },
    { ttlMs: FIVE_MINUTES_MS, renewIntervalMs: ONE_MINUTE_MS }
  );

  // Weekly on Mondays at 06:00
  scheduleWithLock(
    '0 6 * * 1',
    'recurring-shopping-weekly',
    async () => {
      logger.info('[Scheduler] Firing weekly recurring shopping rules...');
      const result = await recurringShoppingItemService.fireRulesForCadence('weekly');
      logger.info({ result }, '[Scheduler] Weekly recurring shopping fire complete');
    },
    { ttlMs: FIVE_MINUTES_MS, renewIntervalMs: ONE_MINUTE_MS }
  );

  // Monthly on the 1st at 06:00
  scheduleWithLock(
    '0 6 1 * *',
    'recurring-shopping-monthly',
    async () => {
      logger.info('[Scheduler] Firing monthly recurring shopping rules...');
      const result = await recurringShoppingItemService.fireRulesForCadence('monthly');
      logger.info({ result }, '[Scheduler] Monthly recurring shopping fire complete');
    },
    { ttlMs: FIVE_MINUTES_MS, renewIntervalMs: ONE_MINUTE_MS }
  );

  logger.info('[Scheduler] Recurring shopping item scheduler started');
}
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage `BackEnd/src/scheduler/recurringShoppingItems.ts`. Proposed commit message:

```
feat(scheduler): add recurring shopping item scheduler (daily/weekly/monthly)
```

---

## Task 16: Backend — wire the scheduler into `index.ts`

**Files:**
- Modify: `BackEnd/src/index.ts`

- [ ] **Step 1: Import and start the new scheduler**

Open `BackEnd/src/index.ts`. After the existing scheduler imports (line 19–21), add:

```ts
import { startRecurringShoppingItemScheduler } from './scheduler/recurringShoppingItems';
```

Then in `startServer()` (around line 130–132), after `startPendingExpenseScheduler();`, add:

```ts
startRecurringShoppingItemScheduler();
```

- [ ] **Step 2: Type-check**

Run: `cd BackEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Boot and verify the scheduler starts**

Run: `cd BackEnd && npm run dev`

Expected log line: `[Scheduler] Recurring shopping item scheduler started`. Stop the server.

- [ ] **Step 4: Stage and commit (user)**

Stage `BackEnd/src/index.ts`. Proposed commit message:

```
feat(server): start recurring shopping item scheduler at boot
```

---

## Task 17: Backend — manual smoke verification (recurring fire + dedupe + TTL)

**Files:**
- Create: `BackEnd/scripts/smoke-v3.ts` (gitignored — see Task 1)

- [ ] **Step 1: Create the smoke script**

Create `BackEnd/scripts/smoke-v3.ts` with:

```ts
/**
 * Manual smoke verification for Shopping List v3.
 *
 *   npx ts-node BackEnd/scripts/smoke-v3.ts <command> [args]
 *
 * Commands:
 *   fire <cadence>                 Invoke fireRulesForCadence and print the result.
 *   dedupe-check                   Insert two identical items via two fires, expect skipped=1.
 *   ttl-check <itemId>             Backdate an existing archived item's archivedAt to 91 days ago.
 *
 * Prereqs: a household + at least one user already exist in the dev DB.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database';
import { recurringShoppingItemService } from '../src/services/recurring-shopping-item.service';
import { ShoppingListItem } from '../src/models/shopping-list-item.model';

dotenv.config();

async function main() {
  await connectDatabase();
  const cmd = process.argv[2];

  try {
    if (cmd === 'fire') {
      const cadence = process.argv[3] as 'daily' | 'weekly' | 'monthly';
      if (!['daily', 'weekly', 'monthly'].includes(cadence)) {
        throw new Error('Usage: smoke-v3 fire <daily|weekly|monthly>');
      }
      const result = await recurringShoppingItemService.fireRulesForCadence(cadence);
      console.log('Fire result:', result);
    } else if (cmd === 'dedupe-check') {
      const cadence = (process.argv[3] as 'daily' | 'weekly' | 'monthly') ?? 'daily';
      const r1 = await recurringShoppingItemService.fireRulesForCadence(cadence);
      const r2 = await recurringShoppingItemService.fireRulesForCadence(cadence);
      console.log('First fire:', r1);
      console.log('Second fire:', r2);
      if (r2.created === 0 && r2.skipped >= r1.created) {
        console.log('PASS: second fire deduped correctly.');
      } else {
        console.log('FAIL: dedupe did not behave as expected.');
        process.exitCode = 1;
      }
    } else if (cmd === 'ttl-check') {
      const itemId = process.argv[3];
      if (!itemId) throw new Error('Usage: smoke-v3 ttl-check <shoppingListItemId>');
      const past = new Date(Date.now() - 91 * 86400 * 1000);
      const item = await ShoppingListItem.findByIdAndUpdate(
        itemId,
        { $set: { archivedAt: past } },
        { new: true }
      );
      if (!item) throw new Error('Item not found');
      console.log('Backdated item to', past.toISOString());
      console.log('Wait ~60s for the TTL monitor to delete it, then verify with:');
      console.log(`  db.shoppinglistitems.findOne({ _id: ObjectId('${itemId}') })`);
    } else {
      console.log('Commands: fire <cadence> | dedupe-check [cadence] | ttl-check <itemId>');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the recurring fire end-to-end**

Open the frontend, log in, and create one rule via curl (or via the UI after Tasks 18+). Then:

```bash
# Pre-flight: confirm at least one active rule exists for cadence=weekly.
mongosh "$MONGODB_URI" --eval 'db.recurringshoppingitems.find({ active: true, cadence: "weekly" }).toArray()'

# Fire once
cd BackEnd && npx ts-node scripts/smoke-v3.ts fire weekly
# Expected: { created: <N>, skipped: 0 }

# Fire again (same cadence) — should dedupe
npx ts-node scripts/smoke-v3.ts fire weekly
# Expected: { created: 0, skipped: <N> }

# Or run the combined check:
npx ts-node scripts/smoke-v3.ts dedupe-check weekly
# Expected: PASS
```

- [ ] **Step 3: Verify the TTL deletion path**

Pick any archived item from the dev DB (`db.shoppinglistitems.findOne({ archivedAt: { $ne: null } })`), backdate its `archivedAt`, and wait for the TTL monitor:

```bash
ITEM_ID=<paste-item-id>
cd BackEnd && npx ts-node scripts/smoke-v3.ts ttl-check $ITEM_ID
# Wait ~90 seconds (TTL monitor runs every 60s and may need an extra cycle)
mongosh "$MONGODB_URI" --eval "db.shoppinglistitems.findOne({ _id: ObjectId('$ITEM_ID') })"
# Expected: null (item deleted)
```

> If the item is still present after 2 minutes, verify the index exists with the correct `expireAfterSeconds: 7776000` and the partial filter (`db.shoppinglistitems.getIndexes()` from Task 2 step 3).

- [ ] **Step 4: Smoke script is gitignored**

Run: `git status BackEnd/scripts/smoke-v3.ts`

Expected: file is shown as ignored / not tracked. No commit needed for this file.

---

## Task 18: Frontend — `useDebouncedValue` hook

**Files:**
- Create: `FrontEnd/src/hooks/useDebouncedValue.ts`

- [ ] **Step 1: Create the hook**

Create `FrontEnd/src/hooks/useDebouncedValue.ts` with:

```ts
import { useEffect, useState } from 'react';

/**
 * Returns a value that lags the input by `delayMs` of idle time.
 * Each new input resets the timer, so updates only flow through after
 * the caller has stopped changing the value for `delayMs` milliseconds.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
```

- [ ] **Step 2: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new file. Proposed commit message:

```
feat(hooks): add useDebouncedValue hook
```

---

## Task 19: Frontend — extend shopping list types with filter shapes

**Files:**
- Modify: `FrontEnd/src/types/shoppingList.types.ts`

- [ ] **Step 1: Append filter types**

Append at the bottom of `FrontEnd/src/types/shoppingList.types.ts`:

```ts
export type BoughtState = 'bought' | 'unbought' | 'all';

export interface ShoppingListFilter {
  search: string;
  categories: ExpenseType[];
  boughtState: BoughtState;
}
```

- [ ] **Step 2: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage `FrontEnd/src/types/shoppingList.types.ts`. Proposed commit message:

```
feat(types): add ShoppingListFilter + BoughtState types
```

---

## Task 20: Frontend — extend the shopping list API to accept filter params

**Files:**
- Modify: `FrontEnd/src/api/shoppingList.api.ts`

- [ ] **Step 1: Add filter param types**

At the top of `FrontEnd/src/api/shoppingList.api.ts`, after the existing imports:

```ts
import type { BoughtState } from '@/types/shoppingList.types';

export interface ListItemsParams {
  search?: string;
  categories?: string[];
  boughtState?: BoughtState;
}

export interface ListHistoryParams {
  cursor?: string;
  limit?: number;
  search?: string;
  categories?: string[];
}
```

- [ ] **Step 2: Update `listItems`**

Replace the existing `listItems` method (currently lines 16–21) with:

```ts
async listItems(householdId: string, params: ListItemsParams = {}): Promise<ShoppingListResult> {
  const { data } = await api.get<ApiSuccessResponse<ShoppingListResult>>(
    `/households/${householdId}/shopping-list`,
    {
      params,
      paramsSerializer: { indexes: null },
    }
  );
  return data.data;
},
```

> `paramsSerializer: { indexes: null }` makes axios serialize `categories: ['a','b']` as `?categories=a&categories=b` (repeat-key form), which matches the express-validator `query('categories').toArray()` shape.

- [ ] **Step 3: Update `listArchivedHistory`**

Replace the existing `listArchivedHistory` (currently lines 79–88) with:

```ts
async listArchivedHistory(
  householdId: string,
  params: ListHistoryParams = {}
): Promise<HistoryPage> {
  const { data } = await api.get<ApiSuccessResponse<HistoryPage>>(
    `/households/${householdId}/shopping-list/history`,
    {
      params,
      paramsSerializer: { indexes: null },
    }
  );
  return data.data;
},
```

- [ ] **Step 4: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: errors in `useShoppingListQueries.ts` (callsite signatures don't match yet) — fixed in Task 22.

- [ ] **Step 5: Stage and commit (user)**

Stage `FrontEnd/src/api/shoppingList.api.ts`. Proposed commit message:

```
feat(api): pass search/categories/boughtState into list + history calls
```

---

## Task 21: Frontend — extend `queryKeys` for filter and recurring

**Files:**
- Modify: `FrontEnd/src/lib/queryKeys.ts`

- [ ] **Step 1: Update `shoppingList` keys + add `recurring`**

Open `FrontEnd/src/lib/queryKeys.ts`. Find the `shoppingList:` block and replace it with:

```ts
shoppingList: {
  all: (householdId: string) => ['shoppingList', householdId] as const,
  list: (
    householdId: string,
    filter?: { search?: string; categories?: string[]; boughtState?: string }
  ) => ['shoppingList', householdId, 'list', filter ?? {}] as const,
  history: (
    householdId: string,
    filter?: { search?: string; categories?: string[] }
  ) => ['shoppingList', householdId, 'history', filter ?? {}] as const,
  recurring: (householdId: string) => ['shoppingList', householdId, 'recurring'] as const,
},
```

> Each filter-key includes the filter object so TanStack Query treats different filters as different cache entries and re-fetches on change. `invalidateQueries({ queryKey: ['shoppingList', householdId] })` (the existing `all` invalidation pattern) still hits all of them because it's a prefix match.

- [ ] **Step 2: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: errors in `useShoppingListQueries.ts` because callsites still pass no filter — fixed next task.

- [ ] **Step 3: Stage and commit (user)**

Stage `FrontEnd/src/lib/queryKeys.ts`. Proposed commit message:

```
feat(queryKeys): include filter in list/history keys, add recurring key
```

---

## Task 22: Frontend — update shopping-list query hooks to accept filter

**Files:**
- Modify: `FrontEnd/src/hooks/queries/useShoppingListQueries.ts`

- [ ] **Step 1: Add the import**

At the top, add:

```ts
import type { ShoppingListFilter } from '@/types/shoppingList.types';
```

- [ ] **Step 2: Replace `useShoppingList`**

Replace the existing `useShoppingList` (lines 17–25) with:

```ts
export function useShoppingList(householdId: string, filter?: ShoppingListFilter) {
  const params = filter
    ? {
        search: filter.search.trim() || undefined,
        categories: filter.categories.length > 0 ? filter.categories : undefined,
        boughtState: filter.boughtState !== 'all' ? filter.boughtState : undefined,
      }
    : undefined;

  return useQuery({
    queryKey: queryKeys.shoppingList.list(householdId, {
      search: params?.search,
      categories: params?.categories,
      boughtState: params?.boughtState,
    }),
    queryFn: () => shoppingListApi.listItems(householdId, params),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
```

- [ ] **Step 3: Replace `useArchivedHistory`**

Replace the existing `useArchivedHistory` (lines 129–143) with:

```ts
export function useArchivedHistory(
  householdId: string,
  filter?: Pick<ShoppingListFilter, 'search' | 'categories'>
) {
  const params = filter
    ? {
        search: filter.search.trim() || undefined,
        categories: filter.categories.length > 0 ? filter.categories : undefined,
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.shoppingList.history(householdId, {
      search: params?.search,
      categories: params?.categories,
    }),
    queryFn: ({ pageParam }) =>
      shoppingListApi.listArchivedHistory(householdId, {
        cursor: pageParam as string | undefined,
        limit: 10,
        ...params,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: HistoryPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
```

- [ ] **Step 4: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors. The existing `ShoppingHistoryView` callsite still works because `filter` is optional.

- [ ] **Step 5: Stage and commit (user)**

Stage `FrontEnd/src/hooks/queries/useShoppingListQueries.ts`. Proposed commit message:

```
feat(hooks): plumb filter param through useShoppingList + useArchivedHistory
```

---

## Task 23: Frontend — `ShoppingFilterBar` component

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/ShoppingFilterBar.tsx`

- [ ] **Step 1: Create the component**

Create `FrontEnd/src/components/dashboard/shared/ShoppingFilterBar.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ExpenseType } from '@/types/onboarding.types';
import type { BoughtState } from '@/types/shoppingList.types';

const DEBOUNCE_MS = 500;
const ALL_CATEGORIES = Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[];

export interface ShoppingFilterBarProps {
  search: string;
  onSearchChange: (s: string) => void;
  selectedCategories: ExpenseType[];
  onToggleCategory: (cat: ExpenseType) => void;
  boughtState?: BoughtState;
  onBoughtStateChange?: (s: BoughtState) => void;
}

export default function ShoppingFilterBar({
  search,
  onSearchChange,
  selectedCategories,
  onToggleCategory,
  boughtState,
  onBoughtStateChange,
}: ShoppingFilterBarProps) {
  // Local state mirrors the input so typing feels instant; debounced value
  // flows up to the parent on each idle period.
  const [localSearch, setLocalSearch] = useState(search);
  const debounced = useDebouncedValue(localSearch, DEBOUNCE_MS);

  useEffect(() => {
    if (debounced !== search) onSearchChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep local in sync if the parent resets it externally (e.g. tab switch).
  useEffect(() => {
    if (search !== localSearch && search !== debounced) {
      setLocalSearch(search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const showBoughtToggle = boughtState !== undefined && onBoughtStateChange !== undefined;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search items..."
          className="pl-9"
          maxLength={120}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const selected = selectedCategories.includes(cat);
          return (
            <Badge
              key={cat}
              variant={selected ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => onToggleCategory(cat)}
            >
              {EXPENSE_TYPE_LABELS[cat]}
            </Badge>
          );
        })}
      </div>

      {showBoughtToggle && (
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {(['all', 'unbought', 'bought'] as BoughtState[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={boughtState === s ? 'default' : 'ghost'}
              className="h-7 px-3 text-xs"
              onClick={() => onBoughtStateChange!(s)}
            >
              {s === 'all' ? 'All' : s === 'unbought' ? 'Unbought' : 'Bought'}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

> `ALL_CATEGORIES` is derived locally from `EXPENSE_TYPE_LABELS` via `Object.keys`, so it doesn't depend on whether `@/types/onboarding.types` exports a separate `EXPENSE_TYPES` constant.

- [ ] **Step 2: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new component. Proposed commit message:

```
feat(shopping-list): add ShoppingFilterBar with search + category chips + bought toggle
```

---

## Task 24: Frontend — wire `ShoppingFilterBar` into `ShoppingListPage` (Active + History)

**Files:**
- Modify: `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`
- Modify: `FrontEnd/src/components/dashboard/shared/ShoppingHistoryView.tsx` (accept filter prop and forward to hook)

- [ ] **Step 1: Update `ShoppingHistoryView` to accept a filter prop**

Open `FrontEnd/src/components/dashboard/shared/ShoppingHistoryView.tsx`. Locate where it calls `useArchivedHistory(householdId)`. Update the component's props to accept `filter?: { search: string; categories: ExpenseType[] }` and pass it through:

```tsx
import type { ExpenseType } from '@/types/onboarding.types';

export interface ShoppingHistoryViewProps {
  householdId: string;
  filter?: { search: string; categories: ExpenseType[] };
}

export default function ShoppingHistoryView({ householdId, filter }: ShoppingHistoryViewProps) {
  // ... existing imports/state above
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useArchivedHistory(householdId, filter);
  // ... rest unchanged
}
```

> Read the existing `ShoppingHistoryView.tsx` first to apply this minimally. The pattern is: pass `filter` through to `useArchivedHistory`. Everything else (rendering, infinite scroll) stays identical.

- [ ] **Step 2: Add filter state and the bar to `ShoppingListPage`**

Open `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`. Add new imports near the top:

```tsx
import ShoppingFilterBar from '@/components/dashboard/shared/ShoppingFilterBar';
import type { ExpenseType } from '@/types/onboarding.types';
import type { BoughtState, ShoppingListFilter } from '@/types/shoppingList.types';
```

Replace the existing `const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');` and the `useShoppingList` call with the filter-aware versions:

```tsx
const [activeTab, setActiveTab] = useState<'active' | 'history' | 'recurring'>('active');

// Session-local filter state (no URL sync). Shared between Active and History tabs
// so a search typed on Active stays applied when switching to History.
const [search, setSearch] = useState('');
const [categories, setCategories] = useState<ExpenseType[]>([]);
const [boughtState, setBoughtState] = useState<BoughtState>('all');

const filter: ShoppingListFilter = { search, categories, boughtState };
const historyFilter = { search, categories };

const { data, isLoading } = useShoppingList(householdId, filter);
```

> Also flip the existing `setActiveTab(v as 'active' | 'history')` cast to `setActiveTab(v as 'active' | 'history' | 'recurring')` — the third tab is added in Task 28; this prepares the type.

- [ ] **Step 3: Add the toggle helper and render the filter bar in Active and History**

Add a small helper inside the page component:

```tsx
const toggleCategory = (cat: ExpenseType) => {
  setCategories((prev) =>
    prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
  );
};
```

Inside `<TabsContent value="active">`, just above `{isLoading ? ... : <ShoppingListView .../>}`, add:

```tsx
<ShoppingFilterBar
  search={search}
  onSearchChange={setSearch}
  selectedCategories={categories}
  onToggleCategory={toggleCategory}
  boughtState={boughtState}
  onBoughtStateChange={setBoughtState}
/>
```

Inside `<TabsContent value="history">`, just above `<ShoppingHistoryView ... />`, add:

```tsx
<ShoppingFilterBar
  search={search}
  onSearchChange={setSearch}
  selectedCategories={categories}
  onToggleCategory={toggleCategory}
/>
```

And update the `<ShoppingHistoryView />` call to pass the filter:

```tsx
<ShoppingHistoryView householdId={householdId} filter={historyFilter} />
```

- [ ] **Step 4: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Manually exercise in the browser**

Run: `cd FrontEnd && npm run dev`

In the browser at `/dashboard/shopping-list`:

- Type "mil" — DevTools Network tab should show ONE `GET /shopping-list?search=mil` 500 ms after the last keystroke (not one per keystroke)
- Click a category chip — should re-query with `?categories=...`; click again to deselect
- Toggle Bought / Unbought / All — verify the list filters
- Switch to History — search should still read "mil"; chip on History should NOT show the Bought toggle
- Switch to Active again — Bought toggle reappears

Stop the dev server.

- [ ] **Step 6: Stage and commit (user)**

Stage `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx` and `FrontEnd/src/components/dashboard/shared/ShoppingHistoryView.tsx`. Proposed commit message:

```
feat(shopping-list): wire ShoppingFilterBar into Active and History tabs
```

---

## Task 25: Frontend — recurring shopping item types

**Files:**
- Create: `FrontEnd/src/types/recurringShoppingItem.types.ts`

- [ ] **Step 1: Create the types file**

Create `FrontEnd/src/types/recurringShoppingItem.types.ts` with:

```ts
import type { ExpenseType } from './onboarding.types';

export type RecurrenceCadence = 'daily' | 'weekly' | 'monthly';

export interface RecurringShoppingItemResponse {
  _id: string;
  householdId: string;
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringShoppingItemInput {
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active?: boolean;
}

export interface UpdateRecurringShoppingItemInput {
  name?: string;
  category?: ExpenseType;
  cadence?: RecurrenceCadence;
  active?: boolean;
}
```

- [ ] **Step 2: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new file. Proposed commit message:

```
feat(types): add RecurringShoppingItem frontend types
```

---

## Task 26: Frontend — recurring shopping item API

**Files:**
- Create: `FrontEnd/src/api/recurringShoppingItem.api.ts`

- [ ] **Step 1: Create the API module**

Create `FrontEnd/src/api/recurringShoppingItem.api.ts` with:

```ts
import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  RecurringShoppingItemResponse,
  CreateRecurringShoppingItemInput,
  UpdateRecurringShoppingItemInput,
} from '@/types/recurringShoppingItem.types';

export interface RecurringShoppingItemListResult {
  rules: RecurringShoppingItemResponse[];
}

export const recurringShoppingItemApi = {
  async listRules(householdId: string): Promise<RecurringShoppingItemListResult> {
    const { data } = await api.get<ApiSuccessResponse<RecurringShoppingItemListResult>>(
      `/households/${householdId}/shopping-list/recurring`
    );
    return data.data;
  },

  async createRule(
    householdId: string,
    input: CreateRecurringShoppingItemInput
  ): Promise<RecurringShoppingItemResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ rule: RecurringShoppingItemResponse }>>(
      `/households/${householdId}/shopping-list/recurring`,
      input
    );
    return data.data.rule;
  },

  async updateRule(
    householdId: string,
    ruleId: string,
    input: UpdateRecurringShoppingItemInput
  ): Promise<RecurringShoppingItemResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ rule: RecurringShoppingItemResponse }>>(
      `/households/${householdId}/shopping-list/recurring/${ruleId}`,
      input
    );
    return data.data.rule;
  },

  async deleteRule(householdId: string, ruleId: string): Promise<void> {
    await api.delete(`/households/${householdId}/shopping-list/recurring/${ruleId}`);
  },
};
```

- [ ] **Step 2: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new file. Proposed commit message:

```
feat(api): add RecurringShoppingItem axios client
```

---

## Task 27: Frontend — recurring shopping item query hooks

**Files:**
- Create: `FrontEnd/src/hooks/queries/useRecurringShoppingItemQueries.ts`
- Modify: `FrontEnd/src/hooks/queries/index.ts` (only if it exists and re-exports query hooks)

- [ ] **Step 1: Create the hooks**

Create `FrontEnd/src/hooks/queries/useRecurringShoppingItemQueries.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  recurringShoppingItemApi,
  type RecurringShoppingItemListResult,
} from '@/api/recurringShoppingItem.api';
import type {
  RecurringShoppingItemResponse,
  CreateRecurringShoppingItemInput,
  UpdateRecurringShoppingItemInput,
} from '@/types/recurringShoppingItem.types';
import { queryKeys } from '@/lib/queryKeys';

export function useRecurringRules(householdId: string) {
  return useQuery<RecurringShoppingItemListResult>({
    queryKey: queryKeys.shoppingList.recurring(householdId),
    queryFn: () => recurringShoppingItemApi.listRules(householdId),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function useCreateRecurringRule(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<RecurringShoppingItemResponse, Error, CreateRecurringShoppingItemInput>({
    mutationFn: (input) => recurringShoppingItemApi.createRule(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.recurring(householdId) });
    },
  });
}

export function useUpdateRecurringRule(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    RecurringShoppingItemResponse,
    Error,
    { ruleId: string; input: UpdateRecurringShoppingItemInput }
  >({
    mutationFn: ({ ruleId, input }) => recurringShoppingItemApi.updateRule(householdId, ruleId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.recurring(householdId) });
    },
  });
}

export function useDeleteRecurringRule(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (ruleId) => recurringShoppingItemApi.deleteRule(householdId, ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.recurring(householdId) });
    },
  });
}
```

- [ ] **Step 2: Re-export from the hooks barrel (if applicable)**

If `FrontEnd/src/hooks/queries/index.ts` exists and re-exports hook modules, add:

```ts
export * from './useRecurringShoppingItemQueries';
```

- [ ] **Step 3: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Stage and commit (user)**

Stage the new hook file (and the barrel if updated). Proposed commit message:

```
feat(hooks): add useRecurringRules + create/update/delete mutations
```

---

## Task 28: Frontend — `AddRecurringItemForm` modal

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/AddRecurringItemForm.tsx`

- [ ] **Step 1: Read the existing `AddShoppingItemForm` for the modal shape**

Open `FrontEnd/src/components/dashboard/shared/AddShoppingItemForm.tsx` and note its high-level structure:
- Uses shadcn `<Dialog>` (or sheet) with `open` / `onOpenChange` props
- Uses controlled `useState` per field, with `useEffect` to seed from the optional edit subject
- Calls one of two mutation hooks on submit based on whether an id is present

Mirror that shape in the new form.

- [ ] **Step 2: Create the form**

Create `FrontEnd/src/components/dashboard/shared/AddRecurringItemForm.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ExpenseType } from '@/types/onboarding.types';
import {
  useCreateRecurringRule,
  useUpdateRecurringRule,
} from '@/hooks/queries/useRecurringShoppingItemQueries';
import type {
  RecurrenceCadence,
  RecurringShoppingItemResponse,
} from '@/types/recurringShoppingItem.types';

const ALL_CATEGORIES = Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[];
const CADENCES: RecurrenceCadence[] = ['daily', 'weekly', 'monthly'];
const CADENCE_LABEL: Record<RecurrenceCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export interface AddRecurringItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  rule?: RecurringShoppingItemResponse;
}

export default function AddRecurringItemForm({
  open,
  onOpenChange,
  householdId,
  rule,
}: AddRecurringItemFormProps) {
  const isEdit = Boolean(rule);
  const [name, setName] = useState(rule?.name ?? '');
  const [category, setCategory] = useState<ExpenseType>(rule?.category ?? 'groceries');
  const [cadence, setCadence] = useState<RecurrenceCadence>(rule?.cadence ?? 'weekly');

  const createMutation = useCreateRecurringRule(householdId);
  const updateMutation = useUpdateRecurringRule(householdId);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Seed fields when opening with a different rule.
  useEffect(() => {
    if (open) {
      setName(rule?.name ?? '');
      setCategory(rule?.category ?? 'groceries');
      setCadence(rule?.cadence ?? 'weekly');
    }
  }, [open, rule]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    try {
      if (rule) {
        await updateMutation.mutateAsync({
          ruleId: rule._id,
          input: { name: trimmed, category, cadence },
        });
      } else {
        await createMutation.mutateAsync({ name: trimmed, category, cadence });
      }
      onOpenChange(false);
    } catch {
      // Mutation error already surfaces via TanStack; nothing extra.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit recurring item' : 'Add recurring item'}</DialogTitle>
            <DialogDescription>
              We'll add this item to your active list automatically on the chosen cadence
              (skipping if it's already on the list).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="recurring-name">Name</Label>
            <Input
              id="recurring-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Milk"
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {EXPENSE_TYPE_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cadence</Label>
            <Select value={cadence} onValueChange={(v) => setCadence(v as RecurrenceCadence)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CADENCES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CADENCE_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || name.trim().length === 0}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

> If the existing `AddShoppingItemForm` uses a different shadcn primitive for its dialog (e.g. `<Sheet>`), use the same primitive here for visual consistency. Read it before pasting and adapt the imports.

- [ ] **Step 2: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Stage and commit (user)**

Stage the new component. Proposed commit message:

```
feat(shopping-list): add AddRecurringItemForm modal (create + edit)
```

---

## Task 29: Frontend — Recurring tab body inside `ShoppingListPage`

**Files:**
- Modify: `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports:

```tsx
import { Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AddRecurringItemForm from '@/components/dashboard/shared/AddRecurringItemForm';
import {
  useRecurringRules,
  useUpdateRecurringRule,
  useDeleteRecurringRule,
} from '@/hooks/queries/useRecurringShoppingItemQueries';
import type { RecurringShoppingItemResponse } from '@/types/recurringShoppingItem.types';
```

- [ ] **Step 2: Add Recurring tab state**

Inside the component, near the other `useState` hooks:

```tsx
const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
const [editingRule, setEditingRule] = useState<RecurringShoppingItemResponse | null>(null);

const { data: rulesData, isLoading: rulesLoading } = useRecurringRules(householdId);
const rules = rulesData?.rules ?? [];

const updateRule = useUpdateRecurringRule(householdId);
const deleteRule = useDeleteRecurringRule(householdId);

function handleToggleActive(rule: RecurringShoppingItemResponse) {
  void updateRule.mutateAsync({ ruleId: rule._id, input: { active: !rule.active } });
}

function handleDeleteRule(rule: RecurringShoppingItemResponse) {
  if (!window.confirm(`Delete recurring item "${rule.name}"?`)) return;
  void deleteRule.mutateAsync(rule._id);
}

const cadenceLabel = (c: 'daily' | 'weekly' | 'monthly') =>
  c === 'daily' ? 'Daily' : c === 'weekly' ? 'Weekly' : 'Monthly';
```

- [ ] **Step 3: Add the Recurring tab to the `<TabsList>` and a new `<TabsContent>`**

Inside the `<TabsList>` (currently has Active and History), add:

```tsx
<TabsTrigger value="recurring">Recurring</TabsTrigger>
```

Below the existing `<TabsContent value="history">` block, add:

```tsx
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
```

- [ ] **Step 4: Render the form modal at the bottom of the page**

Below the existing `<AddShoppingItemForm>` and `<DoneShoppingDialog>`, add:

```tsx
<AddRecurringItemForm
  open={recurringDialogOpen}
  onOpenChange={(o) => {
    setRecurringDialogOpen(o);
    if (!o) setEditingRule(null);
  }}
  householdId={householdId}
  rule={editingRule ?? undefined}
/>
```

- [ ] **Step 5: Type-check**

Run: `cd FrontEnd && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Stage and commit (user)**

Stage `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`. Proposed commit message:

```
feat(shopping-list): add Recurring tab with rule CRUD UI
```

---

## Task 30: End-to-end smoke (frontend + backend)

**Files:** none

- [ ] **Step 1: Boot both servers**

In two terminals:
```
cd BackEnd && npm run dev
cd FrontEnd && npm run dev
```

- [ ] **Step 2: Browser exercise**

In a logged-in browser at `/dashboard/shopping-list`, walk through:

1. **Active filter** — type "milk" in the search box. After 500 ms, only matching items remain. Toggle a category chip; toggle Bought/Unbought.
2. **History filter** — switch to History. Search persists from Active. Toggle a category chip. Bought/Unbought toggle does NOT appear.
3. **Recurring tab** — switch to Recurring.
   - Empty state shows; click "Add recurring item"
   - Create rule "Milk" / Groceries / Weekly. Verify it appears in the list with the correct badges
   - Toggle the Switch off → confirm the row's `active` flips visually; refresh and verify persistence
   - Click pencil → edit the rule's category to Cleaning, save → confirm the badge updates
   - Click trash → confirm dialog → confirm the row disappears

- [ ] **Step 3: End-to-end recurring fire smoke**

With the rule still on (toggle it back on if needed) and the dev servers running:

```bash
# Terminal 3
cd BackEnd && npx ts-node scripts/smoke-v3.ts fire weekly
# Expected: { created: 1, skipped: 0 } (or higher if other rules exist)
```

Refresh the browser → "Milk" appears on the Active list.

```bash
# Re-fire — should dedupe
npx ts-node scripts/smoke-v3.ts fire weekly
# Expected: { created: 0, skipped: 1 }
```

Mark "Milk" as bought + Done shopping → archive it. Then re-fire:

```bash
npx ts-node scripts/smoke-v3.ts fire weekly
# Expected: { created: 1, skipped: 0 } (archived items don't dedupe)
```

- [ ] **Step 4: TTL smoke (optional but recommended)**

Pick any archived item from Mongo and use the smoke script's `ttl-check` command (see Task 17, Step 3). Wait ~90s, confirm deletion.

- [ ] **Step 5: Done**

If all the above pass, the v3 implementation is complete. The user reviews and merges.

---

## Verification summary

| Spec requirement | Verified by |
|---|---|
| TTL auto-prune of history | Task 2 (index creation) + Task 17 (ttl-check smoke) |
| Search escapes regex metacharacters | Task 7 step 5 (`?search=.` returns literal-dot matches) |
| Categories filter both lists | Task 7 step 5 + Task 24 step 5 + Task 30 step 2 |
| Bought/Unbought only on Active | Task 23 component logic + Task 24 step 5 + Task 30 step 2 |
| Search persists across tabs | Task 24 step 5 + Task 30 step 2 |
| Cron fires at fixed schedules | Task 15 (cron expressions) + Task 16 (boot wiring) |
| Recurring dedupe by case-insensitive name + category | Task 11 (collation strength: 2) + Task 30 step 3 |
| Archived items don't dedupe | Task 11 (`archivedAt: { $exists: false }`) + Task 30 step 3 |
| Any-member CRUD on recurring rules | Task 13 + Task 14 (no admin gate; `getHouseholdForMember` only) |
| 500 ms debounce on search | Task 18 + Task 23 + Task 24 step 5 (one network call per debounced burst) |
| Filter is session-local, no URL sync | Task 24 step 2 (page-local `useState` only) |
