# Shopping List v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-item categories (matching expense categories), trip-grouped paginated history, manual archive + restore, inline editing, and a `beforeunload` hard nav guard to the existing v1 shopping list.

**Architecture:** Extend in place — same model, same service, same routes file, same components. The conversion flow now archives instead of deleting; bought items get `archivedExpenseId` snapshots so the History tab can group them. Manual archives skip the expense link and are restorable. UI gains a Tabs split (Active | History), a category dropdown on the form, three icons per active row, and a `beforeunload` listener guarded by the bought-count.

**Tech Stack:** Backend — Node.js + Express + TypeScript + Mongoose. Frontend — React + TypeScript + Vite + TanStack Query (`useInfiniteQuery` for history) + shadcn/ui (Tabs, Sheet, Select).

**Reference:**
- Spec: `docs/superpowers/specs/2026-04-30-shopping-list-v2-design.md`
- v1 spec (built upon): `docs/superpowers/specs/2026-04-30-shopping-list-design.md`
- v1 plan (already executed): `docs/superpowers/plans/2026-04-30-shopping-list.md`

**Test infrastructure note:** The repo has no test runner configured (`BackEnd/package.json` `test` echoes an error; `FrontEnd/package.json` has no `test` script). Each task uses **manual verification gates** — `tsc --noEmit` for types, `npm run build` for full bundling, `npm run lint` for new lint warnings, plus targeted curl flows and browser walkthroughs. The spirit of TDD (verify before moving on) is preserved.

**Commit policy:** The user handles commits. Tasks end at type-check / verification — do **not** run `git commit` or `git add` from a subagent.

---

## Phase Overview

| Phase | Tasks | Output |
|---|---|---|
| 0 — Pre-flight | 0 | Backend recovered from prior docker crash |
| A — Backend | 1 – 6 | Backend supports categories, archive/restore, history pagination |
| B — Frontend data layer | 7 – 11 | Types, API client, hooks, queryKeys, barrel updated |
| C — Form & list components | 12 – 13 | AddShoppingItemForm has category + edit mode; ShoppingListView has 3 icons + badge |
| D — History + utilities | 14 – 16 | ShoppingHistoryView, useBeforeUnload hook, dominant-category util |
| E — Page wiring | 17 – 18 | ShoppingListPage with Tabs + guard + archiveBought; DoneShoppingDialog grouped by category |
| F — Final verification | 19 | Type-check + lint + build + full E2E walkthrough |

---

## Task 0: Backend recovery (pre-flight)

**Required**: backend is currently in a crash-restart loop because the `splitmate-backend` container's `node_modules` named volume was recreated empty during the previous session's `docker compose up` and `pino-pretty` (a runtime dependency referenced by `dist/utils/logger.js:8`) is missing.

This task is **non-code** — only docker commands. May be run by the human user.

**Files:**
- None modified.

- [ ] **Step 1: Confirm backend is actually unhealthy**

```bash
docker compose ps
```

Expected: `splitmate-backend` row shows `Restarting (1)` or similar. If it shows `Up`, skip the rest of Task 0 — the backend recovered or was fixed independently. Continue to Phase A.

- [ ] **Step 2: Stop backend and remove its empty node_modules volume**

```bash
docker compose stop backend
docker volume rm shared-living-manager_backend_node_modules
```

If `docker volume rm` errors with "in use", make sure step 1's `stop` completed. Mongo and frontend volumes are NOT touched.

- [ ] **Step 3: Rebuild backend image and start with a fresh volume**

```bash
docker compose up -d --build backend
```

Docker recreates `shared-living-manager_backend_node_modules` empty, then on first mount populates it from the freshly-built image's `/app/node_modules` (which `npm install` populated, including `pino-pretty`).

- [ ] **Step 4: Verify backend is healthy**

```bash
docker compose logs --tail 30 backend
```

Look for log lines indicating successful startup (e.g., "Server listening on port 5000" or similar). NO `Error: unable to determine transport target for "pino-pretty"`.

```bash
docker compose ps backend
```

Expected: `Status: Up <Ns>`. No `Restarting`.

If still crashing, escalate — do not proceed to Phase A.

---

## Phase A — Backend

### Task 1: Backend types — add category and archive fields

**Files:**
- Modify: `BackEnd/src/types/shopping-list.types.ts`

- [ ] **Step 1: Read the existing v1 types file** so you know the current shape.

```bash
cat BackEnd/src/types/shopping-list.types.ts
```

It currently exports `IShoppingListItem`, `IAddShoppingItemInput`, `IShoppingListItemResponse`. Confirm.

- [ ] **Step 2: Replace the file with the v2 version** including category, archive fields, new input/response types

Overwrite the file with EXACTLY this content:

```typescript
import { Document, Types } from 'mongoose';
import { ExpenseType } from './expense.types';

export interface IShoppingListItem extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
  addedByUserId: Types.ObjectId;
  isBought: boolean;
  boughtAt?: Date;
  boughtByMemberId?: Types.ObjectId;
  archivedAt?: Date;
  archivedExpenseId?: Types.ObjectId;
  archivedDominantCategory?: ExpenseType;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
}

export interface IUpdateShoppingItemInput {
  name?: string;
  quantity?: string;
  notes?: string;
  category?: ExpenseType;
}

export interface IArchiveBoughtInput {
  expenseId: string;
  dominantCategory: ExpenseType;
}

export interface IListHistoryInput {
  cursor?: string;  // ISO date string
  limit?: number;
}

export interface IShoppingListItemResponse {
  _id: string;
  householdId: string;
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
  addedByUserId: string;
  isBought: boolean;
  boughtAt?: string;
  boughtByMemberId?: string;
  boughtByNickname?: string;
  archivedAt?: string;
  archivedExpenseId?: string;
  archivedDominantCategory?: ExpenseType;
  createdAt: string;
  updatedAt: string;
}

export type HistoryEntry =
  | {
      type: 'trip';
      archivedAt: string;
      items: IShoppingListItemResponse[];
      expenseId: string;
      dominantCategory: ExpenseType;
    }
  | {
      type: 'manual';
      archivedAt: string;
      items: IShoppingListItemResponse[];  // length 1
    };

export interface IListHistoryResult {
  entries: HistoryEntry[];
  nextCursor: string | null;
}
```

- [ ] **Step 3: Verify `ExpenseType` is importable from the path you just used**

```bash
grep -n "export type ExpenseType\|export.*ExpenseType" BackEnd/src/types/expense.types.ts
```

If `ExpenseType` is exported from that file, the import works. If it's exported from another file, change the import accordingly.

If `ExpenseType` doesn't exist in `BackEnd/src/types/`, search for where it's defined:

```bash
grep -rn "type ExpenseType\|EXPENSE_TYPES" BackEnd/src --include="*.ts" | head -10
```

Use the actual path. It's likely either in `expense.types.ts` or inline in the expense model. If it's only inline (no exported type alias), add this near the top of `expense.types.ts`:

```typescript
export type ExpenseType = 'rent' | 'utilities' | 'internet' | 'groceries' | 'cleaning' | 'subscriptions' | 'other';
```

(Match exactly the values the existing expense model accepts.)

- [ ] **Step 4: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes. If it fails because of a missing import, re-check Step 3.

---

### Task 2: Backend model — add category and archive fields

**Files:**
- Modify: `BackEnd/src/models/shopping-list-item.model.ts`

- [ ] **Step 1: Read the existing v1 model**

```bash
cat BackEnd/src/models/shopping-list-item.model.ts
```

- [ ] **Step 2: Find the existing `EXPENSE_TYPES` source on the backend**

The category field needs to validate against the expense types enum. Find where it's defined:

```bash
grep -rn "EXPENSE_TYPES\|category.*enum" BackEnd/src --include="*.ts" | head
```

Use the same source the expense model uses. If it's a constant in `expense.model.ts`, import it. If it's an inline `enum:` array on the schema, replicate the same value list.

- [ ] **Step 3: Replace the file with the v2 version**

Overwrite with EXACTLY this (assuming `EXPENSE_TYPES` is importable from `../types/expense.types` — adjust the import path per Step 2):

```typescript
import { Schema, model } from 'mongoose';
import { IShoppingListItem } from '../types/shopping-list.types';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

const shoppingListItemSchema = new Schema<IShoppingListItem>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    quantity: { type: String, trim: true, maxlength: 50, default: undefined },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
    category: {
      type: String,
      enum: EXPENSE_TYPE_VALUES,
      required: true,
      default: 'groceries',
    },
    addedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isBought: { type: Boolean, default: false },
    boughtAt: { type: Date, default: undefined },
    boughtByMemberId: { type: Schema.Types.ObjectId, default: undefined },
    archivedAt: { type: Date, default: undefined },
    archivedExpenseId: { type: Schema.Types.ObjectId, ref: 'Expense', default: undefined },
    archivedDominantCategory: {
      type: String,
      enum: EXPENSE_TYPE_VALUES,
      default: undefined,
    },
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

shoppingListItemSchema.index({ householdId: 1, isBought: 1, createdAt: -1 });
shoppingListItemSchema.index({ _id: 1, householdId: 1 });
shoppingListItemSchema.index({ householdId: 1, archivedAt: -1 });

export const ShoppingListItem = model<IShoppingListItem>('ShoppingListItem', shoppingListItemSchema);
```

The inlined `EXPENSE_TYPE_VALUES` is intentional — Mongoose's `enum:` option needs a runtime array, and duplicating it locally avoids a compile-time circular reference between the types file and the model file. The values must match `EXPENSE_TYPES` in the types file.

- [ ] **Step 3: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

---

### Task 3: Backend validators — category, update, archive-bought, history

**Files:**
- Modify: `BackEnd/src/validators/shopping-list.validator.ts`

- [ ] **Step 1: Read the existing v1 validator file**

```bash
cat BackEnd/src/validators/shopping-list.validator.ts
```

- [ ] **Step 2: Replace with the v2 version** including the new validators

Overwrite with EXACTLY this:

```typescript
import { body, param, query, ValidationChain } from 'express-validator';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

export const addShoppingItemValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('quantity')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Quantity cannot exceed 50 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('category')
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),
];

export const updateShoppingItemValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('itemId')
    .isMongoId()
    .withMessage('Invalid shopping list item ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('quantity')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Quantity cannot exceed 50 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('category')
    .optional()
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),
];

export const shoppingItemIdValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('itemId')
    .isMongoId()
    .withMessage('Invalid shopping list item ID'),
];

export const householdIdOnlyValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),
];

export const archiveBoughtValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  body('expenseId')
    .isMongoId()
    .withMessage('Invalid expense ID'),

  body('dominantCategory')
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid dominant category'),
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
];
```

- [ ] **Step 3: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

---

### Task 4: Backend service — categories, update, archive/restore, archiveBought, history

**Files:**
- Modify: `BackEnd/src/services/shopping-list.service.ts`

This is the biggest backend change. Read carefully and replace the entire service.

- [ ] **Step 1: Read the existing v1 service**

```bash
cat BackEnd/src/services/shopping-list.service.ts
```

You'll see methods: `addItem`, `listItems`, `toggleBought`, `deleteItem`, `clearBought`. The v2 version: keeps `toggleBought` and `deleteItem` unchanged; extends `addItem` with `category`; extends `listItems` with archive filter; replaces `clearBought` with `archiveBought`; adds `updateItem`, `archiveItem`, `restoreItem`, `listArchivedHistory`.

- [ ] **Step 2: Replace the service file with the v2 version**

Overwrite with EXACTLY this:

```typescript
import { Types } from 'mongoose';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import {
  IShoppingListItem,
  IAddShoppingItemInput,
  IUpdateShoppingItemInput,
  IShoppingListItemResponse,
  HistoryEntry,
  IListHistoryResult,
} from '../types/shopping-list.types';
import { ExpenseType } from '../types/expense.types';
import { NotFoundError, BadRequestError } from '../utils/error';
import { getHouseholdForMember } from '../utils/household.helpers';

class ShoppingListService {
  async addItem(
    householdId: string,
    userId: string,
    input: IAddShoppingItemInput
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.create({
      householdId: household._id,
      name: input.name.trim(),
      ...(input.quantity?.trim() && { quantity: input.quantity.trim() }),
      ...(input.notes?.trim() && { notes: input.notes.trim() }),
      category: input.category,
      addedByUserId: userId,
    });

    return this.formatResponse(item);
  }

  async listItems(
    householdId: string,
    userId: string,
    options: { archived?: boolean } = {}
  ): Promise<{ items: IShoppingListItemResponse[] }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const archivedFilter = options.archived
      ? { archivedAt: { $ne: null } }
      : { archivedAt: null };

    const items = await ShoppingListItem.find({
      householdId: household._id,
      ...archivedFilter,
    })
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

  async toggleBought(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<IShoppingListItemResponse> {
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (item.archivedAt) throw BadRequestError('Cannot toggle bought on an archived item');

    item.isBought = !item.isBought;
    if (item.isBought) {
      item.boughtAt = new Date();
      item.boughtByMemberId = requesterMember._id as unknown as Types.ObjectId;
    } else {
      item.boughtAt = undefined;
      item.boughtByMemberId = undefined;
    }
    await item.save();

    const boughtByNickname = item.isBought ? requesterMember.nickname : undefined;
    return this.formatResponse(item, boughtByNickname);
  }

  async updateItem(
    householdId: string,
    userId: string,
    itemId: string,
    input: IUpdateShoppingItemInput
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (item.archivedAt) throw BadRequestError('Cannot update an archived item');

    if (input.name !== undefined) item.name = input.name.trim();
    if (input.quantity !== undefined) {
      const trimmed = input.quantity.trim();
      item.quantity = trimmed.length > 0 ? trimmed : undefined;
    }
    if (input.notes !== undefined) {
      const trimmed = input.notes.trim();
      item.notes = trimmed.length > 0 ? trimmed : undefined;
    }
    if (input.category !== undefined) item.category = input.category;

    await item.save();
    return this.formatResponse(item);
  }

  async deleteItem(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<void> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');

    await item.deleteOne();
  }

  async archiveItem(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (item.archivedAt) throw BadRequestError('Item is already archived');

    item.archivedAt = new Date();
    // archivedExpenseId stays undefined — distinguishes manual archive from conversion archive
    await item.save();

    return this.formatResponse(item);
  }

  async restoreItem(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (!item.archivedAt) throw BadRequestError('Item is not archived');
    if (item.archivedExpenseId) {
      throw BadRequestError('Cannot restore an item that was archived as part of an expense');
    }

    item.archivedAt = undefined;
    item.isBought = false;
    item.boughtAt = undefined;
    item.boughtByMemberId = undefined;
    await item.save();

    return this.formatResponse(item);
  }

  async archiveBought(
    householdId: string,
    userId: string,
    expenseId: string,
    dominantCategory: ExpenseType
  ): Promise<{ archivedCount: number }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const now = new Date();
    const result = await ShoppingListItem.updateMany(
      {
        householdId: household._id,
        isBought: true,
        archivedAt: null,
      },
      {
        $set: {
          archivedAt: now,
          archivedExpenseId: new Types.ObjectId(expenseId),
          archivedDominantCategory: dominantCategory,
        },
      }
    );

    return { archivedCount: result.modifiedCount ?? 0 };
  }

  async listArchivedHistory(
    householdId: string,
    userId: string,
    cursor?: string,
    limit: number = 10
  ): Promise<IListHistoryResult> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const archivedFilter: Record<string, unknown> = {
      householdId: household._id,
      archivedAt: { $ne: null },
    };
    if (cursor) {
      archivedFilter.archivedAt = { $ne: null, $lt: new Date(cursor) };
    }

    // Fetch enough items to fill `limit + 1` groups so we can detect if more pages exist.
    // For typical household volumes this is fine; if archive grows beyond ~10k items,
    // switch to a Mongo aggregation pipeline with $group + $limit.
    const items = await ShoppingListItem.find(archivedFilter)
      .sort({ archivedAt: -1 })
      .lean();

    // Build a member map for nickname lookups
    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    // Group items: same archivedExpenseId → one trip entry; null archivedExpenseId → individual manual entries
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

  private formatResponse(
    item: IShoppingListItem,
    boughtByNickname?: string
  ): IShoppingListItemResponse {
    return {
      _id: item._id.toString(),
      householdId: item.householdId.toString(),
      name: item.name,
      ...(item.quantity && { quantity: item.quantity }),
      ...(item.notes && { notes: item.notes }),
      category: item.category,
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
      ...(item.archivedAt && { archivedAt: item.archivedAt.toISOString() }),
      ...(item.archivedExpenseId && { archivedExpenseId: item.archivedExpenseId.toString() }),
      ...(item.archivedDominantCategory && { archivedDominantCategory: item.archivedDominantCategory }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  // Used when documents come from .lean()
  private formatLeanResponse(
    item: {
      _id: Types.ObjectId;
      householdId: Types.ObjectId;
      name: string;
      quantity?: string;
      notes?: string;
      category: ExpenseType;
      addedByUserId: Types.ObjectId;
      isBought: boolean;
      boughtAt?: Date;
      boughtByMemberId?: Types.ObjectId;
      archivedAt?: Date;
      archivedExpenseId?: Types.ObjectId;
      archivedDominantCategory?: ExpenseType;
      createdAt: Date;
      updatedAt: Date;
    },
    boughtByNickname?: string
  ): IShoppingListItemResponse {
    return {
      _id: item._id.toString(),
      householdId: item.householdId.toString(),
      name: item.name,
      ...(item.quantity && { quantity: item.quantity }),
      ...(item.notes && { notes: item.notes }),
      category: item.category,
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
      ...(item.archivedAt && { archivedAt: item.archivedAt.toISOString() }),
      ...(item.archivedExpenseId && { archivedExpenseId: item.archivedExpenseId.toString() }),
      ...(item.archivedDominantCategory && { archivedDominantCategory: item.archivedDominantCategory }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export const shoppingListService = new ShoppingListService();
```

- [ ] **Step 3: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

If `ExpenseType` import fails, double-check Task 1's path resolution.

---

### Task 5: Backend controller — update + archive + restore + history endpoints

**Files:**
- Modify: `BackEnd/src/controllers/shopping-list.controller.ts`

- [ ] **Step 1: Read the existing v1 controller**

```bash
cat BackEnd/src/controllers/shopping-list.controller.ts
```

It currently has: `addItem`, `listItems`, `toggleBought`, `deleteItem`, `clearBought`. v2 keeps the first four, removes `clearBought`, adds 4 new methods.

- [ ] **Step 2: Replace the controller file with the v2 version**

Overwrite with EXACTLY this:

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { shoppingListService } from '../services/shopping-list.service';
import {
  IAddShoppingItemInput,
  IUpdateShoppingItemInput,
  IArchiveBoughtInput,
} from '../types/shopping-list.types';

class ShoppingListController {
  // POST /api/households/:id/shopping-list
  async addItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const input = req.body as IAddShoppingItemInput;
      const item = await shoppingListService.addItem(householdId, req.user.userId, input);
      res.status(201).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/shopping-list
  async listItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const archived = req.query.archived === 'true';
      const result = await shoppingListService.listItems(householdId, req.user.userId, { archived });
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/shopping-list/:itemId
  async updateItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const input = req.body as IUpdateShoppingItemInput;
      const item = await shoppingListService.updateItem(householdId, req.user.userId, itemId, input);
      res.status(200).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/shopping-list/:itemId/bought
  async toggleBought(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const item = await shoppingListService.toggleBought(householdId, req.user.userId, itemId);
      res.status(200).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/shopping-list/:itemId/archive
  async archiveItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const item = await shoppingListService.archiveItem(householdId, req.user.userId, itemId);
      res.status(200).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/shopping-list/:itemId/restore
  async restoreItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const item = await shoppingListService.restoreItem(householdId, req.user.userId, itemId);
      res.status(200).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/shopping-list/:itemId
  async deleteItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      await shoppingListService.deleteItem(householdId, req.user.userId, itemId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/shopping-list/archive-bought
  async archiveBought(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const { expenseId, dominantCategory } = req.body as IArchiveBoughtInput;
      const result = await shoppingListService.archiveBought(
        householdId,
        req.user.userId,
        expenseId,
        dominantCategory
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

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
      const result = await shoppingListService.listArchivedHistory(
        householdId,
        req.user.userId,
        cursor,
        limit
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const shoppingListController = new ShoppingListController();
```

- [ ] **Step 3: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

---

### Task 6: Backend routes — add new endpoints, replace clear-bought

**Files:**
- Modify: `BackEnd/src/routes/shopping-list.routes.ts`

- [ ] **Step 1: Read the existing routes file**

```bash
cat BackEnd/src/routes/shopping-list.routes.ts
```

- [ ] **Step 2: Replace with the v2 version**

Overwrite with EXACTLY this:

```typescript
import { Router } from 'express';
import { shoppingListController } from '../controllers/shopping-list.controller';
import {
  addShoppingItemValidation,
  updateShoppingItemValidation,
  shoppingItemIdValidation,
  householdIdOnlyValidation,
  archiveBoughtValidation,
  historyValidation,
} from '../validators/shopping-list.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// POST /api/households/:id/shopping-list
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  addShoppingItemValidation,
  handleValidationErrors,
  shoppingListController.addItem.bind(shoppingListController)
);

// GET /api/households/:id/shopping-list
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  householdIdOnlyValidation,
  handleValidationErrors,
  shoppingListController.listItems.bind(shoppingListController)
);

// GET /api/households/:id/shopping-list/history — must be before /:itemId routes
router.get(
  '/history',
  authMiddleware,
  emailVerifiedMiddleware,
  historyValidation,
  handleValidationErrors,
  shoppingListController.listArchivedHistory.bind(shoppingListController)
);

// POST /api/households/:id/shopping-list/archive-bought — must be before /:itemId routes
router.post(
  '/archive-bought',
  authMiddleware,
  emailVerifiedMiddleware,
  archiveBoughtValidation,
  handleValidationErrors,
  shoppingListController.archiveBought.bind(shoppingListController)
);

// PATCH /api/households/:id/shopping-list/:itemId
router.patch(
  '/:itemId',
  authMiddleware,
  emailVerifiedMiddleware,
  updateShoppingItemValidation,
  handleValidationErrors,
  shoppingListController.updateItem.bind(shoppingListController)
);

// PATCH /api/households/:id/shopping-list/:itemId/bought
router.patch(
  '/:itemId/bought',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.toggleBought.bind(shoppingListController)
);

// POST /api/households/:id/shopping-list/:itemId/archive
router.post(
  '/:itemId/archive',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.archiveItem.bind(shoppingListController)
);

// POST /api/households/:id/shopping-list/:itemId/restore
router.post(
  '/:itemId/restore',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.restoreItem.bind(shoppingListController)
);

// DELETE /api/households/:id/shopping-list/:itemId
router.delete(
  '/:itemId',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.deleteItem.bind(shoppingListController)
);

export default router;
```

Key change: **`/clear-bought` is gone**. The literal-paths `/history`, `/archive-bought`, `/:itemId/archive`, `/:itemId/restore` are added. Literal paths come before `/:itemId` paths to avoid Express matching `archive-bought` as a `:itemId`.

- [ ] **Step 3: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

- [ ] **Step 4: Restart backend so the new routes are loaded**

```bash
docker compose restart backend
docker compose logs --tail 20 backend
```

Expected: backend starts cleanly. No errors.

- [ ] **Step 5: Curl smoke test (manual)**

Need a real JWT and household ID from your browser localStorage:

```bash
TOKEN="<paste-jwt>"
HID="<paste-household-id>"

# Add an item with category
curl -i -X POST "http://localhost:5000/api/households/$HID/shopping-list" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"milk","quantity":"2L","category":"groceries"}'
# Expected: 201; response item has category: "groceries"

# Add without category — should fail validation
curl -i -X POST "http://localhost:5000/api/households/$HID/shopping-list" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"sponge"}'
# Expected: 400; validator error mentions category

# Update an item (replace ITEM_ID with the _id from the first POST)
ITEM_ID="<paste-item-id>"
curl -i -X PATCH "http://localhost:5000/api/households/$HID/shopping-list/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"cleaning"}'
# Expected: 200; item.category is now "cleaning"

# Manual archive
curl -i -X POST "http://localhost:5000/api/households/$HID/shopping-list/$ITEM_ID/archive" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200; item now has archivedAt set, archivedExpenseId null

# Restore
curl -i -X POST "http://localhost:5000/api/households/$HID/shopping-list/$ITEM_ID/restore" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200; archivedAt cleared, isBought false

# History (paginated)
curl -i "http://localhost:5000/api/households/$HID/shopping-list/history?limit=10" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200; { entries: [...], nextCursor: ... }
```

If any expected behaviour differs, stop and report — do not proceed to Phase B.

---

## Phase B — Frontend data layer

### Task 7: Frontend EXPENSE_TYPE_LABELS — verify or add

**Files:**
- Modify (only if needed): `FrontEnd/src/types/onboarding.types.ts`

- [ ] **Step 1: Check whether EXPENSE_TYPE_LABELS already exists**

```bash
grep -n "EXPENSE_TYPE_LABELS\|export.*EXPENSE_TYPES" FrontEnd/src/types/onboarding.types.ts
grep -rn "EXPENSE_TYPE_LABELS" FrontEnd/src --include="*.ts" --include="*.tsx" | head -5
```

If `EXPENSE_TYPE_LABELS` is already exported from anywhere, NOTE the path and skip to step 3. The Expenses tab probably already shows friendly labels somewhere.

- [ ] **Step 2: Add EXPENSE_TYPE_LABELS if missing**

If it doesn't exist, append to `FrontEnd/src/types/onboarding.types.ts` immediately after the existing `EXPENSE_TYPES` declaration (search for `export const EXPENSE_TYPES`):

```typescript
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  internet: 'Internet',
  groceries: 'Groceries',
  cleaning: 'Cleaning',
  subscriptions: 'Subscriptions',
  other: 'Other',
};
```

- [ ] **Step 3: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

---

### Task 8: Frontend types — extend ShoppingListItemResponse, add new types

**Files:**
- Modify: `FrontEnd/src/types/shoppingList.types.ts`

- [ ] **Step 1: Read the existing types file**

```bash
cat FrontEnd/src/types/shoppingList.types.ts
```

- [ ] **Step 2: Replace with the v2 version**

Overwrite with EXACTLY this:

```typescript
import type { ExpenseType } from './onboarding.types';

export interface ShoppingListItemResponse {
  _id: string;
  householdId: string;
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
  addedByUserId: string;
  isBought: boolean;
  boughtAt?: string;
  boughtByMemberId?: string;
  boughtByNickname?: string;
  archivedAt?: string;
  archivedExpenseId?: string;
  archivedDominantCategory?: ExpenseType;
  createdAt: string;
  updatedAt: string;
}

export interface AddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
}

export interface UpdateShoppingItemInput {
  name?: string;
  quantity?: string;
  notes?: string;
  category?: ExpenseType;
}

export type HistoryEntry =
  | {
      type: 'trip';
      archivedAt: string;
      items: ShoppingListItemResponse[];
      expenseId: string;
      dominantCategory: ExpenseType;
    }
  | {
      type: 'manual';
      archivedAt: string;
      items: ShoppingListItemResponse[];
    };

export interface HistoryPage {
  entries: HistoryEntry[];
  nextCursor: string | null;
}
```

- [ ] **Step 3: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Note: this WILL fail because `ShoppingListPage.tsx` and other v1 callers don't yet pass `category` to `addItem`. That's expected — Tasks 9-18 fix the callers. For now confirm the only errors are about missing `category` fields, then proceed.

---

### Task 9: Frontend queryKeys — add history key

**Files:**
- Modify: `FrontEnd/src/lib/queryKeys.ts`

- [ ] **Step 1: Find the existing shoppingList block**

```bash
grep -n "shoppingList:" FrontEnd/src/lib/queryKeys.ts
```

- [ ] **Step 2: Add a `history` entry next to the existing `all` and `list`**

Inside the `shoppingList:` block, change:

```typescript
  shoppingList: {
    all: (householdId: string) => ['shoppingList', householdId] as const,
    list: (householdId: string) => ['shoppingList', householdId, 'list'] as const,
  },
```

to:

```typescript
  shoppingList: {
    all: (householdId: string) => ['shoppingList', householdId] as const,
    list: (householdId: string) => ['shoppingList', householdId, 'list'] as const,
    history: (householdId: string) => ['shoppingList', householdId, 'history'] as const,
  },
```

- [ ] **Step 3: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: same errors as Task 8 (about missing category) — no new ones.

---

### Task 10: Frontend API client — categories, update, archive, restore, history

**Files:**
- Modify: `FrontEnd/src/api/shoppingList.api.ts`

- [ ] **Step 1: Read existing API client**

```bash
cat FrontEnd/src/api/shoppingList.api.ts
```

- [ ] **Step 2: Replace with the v2 version**

Overwrite with EXACTLY this:

```typescript
import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  ShoppingListItemResponse,
  AddShoppingItemInput,
  UpdateShoppingItemInput,
  HistoryPage,
} from '@/types/shoppingList.types';
import type { ExpenseType } from '@/types/onboarding.types';

export interface ShoppingListResult {
  items: ShoppingListItemResponse[];
}

export const shoppingListApi = {
  async listItems(householdId: string): Promise<ShoppingListResult> {
    const { data } = await api.get<ApiSuccessResponse<ShoppingListResult>>(
      `/households/${householdId}/shopping-list`
    );
    return data.data;
  },

  async addItem(householdId: string, input: AddShoppingItemInput): Promise<ShoppingListItemResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list`,
      input
    );
    return data.data.item;
  },

  async updateItem(
    householdId: string,
    itemId: string,
    input: UpdateShoppingItemInput
  ): Promise<ShoppingListItemResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}`,
      input
    );
    return data.data.item;
  },

  async toggleBought(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/bought`
    );
    return data.data.item;
  },

  async archiveItem(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/archive`
    );
    return data.data.item;
  },

  async restoreItem(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/restore`
    );
    return data.data.item;
  },

  async deleteItem(householdId: string, itemId: string): Promise<void> {
    await api.delete(`/households/${householdId}/shopping-list/${itemId}`);
  },

  async archiveBought(
    householdId: string,
    input: { expenseId: string; dominantCategory: ExpenseType }
  ): Promise<{ archivedCount: number }> {
    const { data } = await api.post<ApiSuccessResponse<{ archivedCount: number }>>(
      `/households/${householdId}/shopping-list/archive-bought`,
      input
    );
    return data.data;
  },

  async listArchivedHistory(
    householdId: string,
    params: { cursor?: string; limit?: number } = {}
  ): Promise<HistoryPage> {
    const { data } = await api.get<ApiSuccessResponse<HistoryPage>>(
      `/households/${householdId}/shopping-list/history`,
      { params }
    );
    return data.data;
  },
};
```

The `clearBought` method is **removed**. `archiveBought` replaces it with a richer signature.

- [ ] **Step 3: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: same errors as Task 8 (callers haven't been updated yet).

---

### Task 11: Frontend query hooks — categories, archive, restore, history infinite query, barrel update

**Files:**
- Modify: `FrontEnd/src/hooks/queries/useShoppingListQueries.ts`
- Modify: `FrontEnd/src/hooks/queries/index.ts`

- [ ] **Step 1: Replace useShoppingListQueries.ts with the v2 version**

Overwrite `FrontEnd/src/hooks/queries/useShoppingListQueries.ts` with EXACTLY this:

```typescript
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { shoppingListApi, type ShoppingListResult } from '@/api/shoppingList.api';
import type {
  ShoppingListItemResponse,
  AddShoppingItemInput,
  UpdateShoppingItemInput,
  HistoryPage,
} from '@/types/shoppingList.types';
import type { ExpenseType } from '@/types/onboarding.types';
import { queryKeys } from '@/lib/queryKeys';

export function useShoppingList(householdId: string) {
  return useQuery({
    queryKey: queryKeys.shoppingList.list(householdId),
    queryFn: () => shoppingListApi.listItems(householdId),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function useAddShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShoppingListItemResponse, Error, AddShoppingItemInput>({
    mutationFn: (input) => shoppingListApi.addItem(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useUpdateShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ShoppingListItemResponse,
    Error,
    { itemId: string; input: UpdateShoppingItemInput }
  >({
    mutationFn: ({ itemId, input }) => shoppingListApi.updateItem(householdId, itemId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useToggleShoppingItemBought(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string, { previous: ShoppingListResult | undefined }>({
    mutationFn: (itemId: string) => shoppingListApi.toggleBought(householdId, itemId),
    onMutate: async (itemId) => {
      const listKey = queryKeys.shoppingList.list(householdId);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<ShoppingListResult>(listKey);
      queryClient.setQueryData<ShoppingListResult>(listKey, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((i) =>
                i._id === itemId ? { ...i, isBought: !i.isBought } : i
              ),
            }
          : old
      );
      return { previous };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.shoppingList.list(householdId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.shoppingList.all(householdId),
        refetchType: 'active',
      });
    },
  });
}

export function useArchiveShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShoppingListItemResponse, Error, string>({
    mutationFn: (itemId: string) => shoppingListApi.archiveItem(householdId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useRestoreShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShoppingListItemResponse, Error, string>({
    mutationFn: (itemId: string) => shoppingListApi.restoreItem(householdId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useDeleteShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (itemId: string) => shoppingListApi.deleteItem(householdId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useArchiveBoughtShoppingItems(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    { archivedCount: number },
    Error,
    { expenseId: string; dominantCategory: ExpenseType }
  >({
    mutationFn: (input) => shoppingListApi.archiveBought(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useArchivedHistory(householdId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.shoppingList.history(householdId),
    queryFn: ({ pageParam }) =>
      shoppingListApi.listArchivedHistory(householdId, {
        cursor: pageParam as string | undefined,
        limit: 10,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: HistoryPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
```

The previous `useClearBoughtShoppingItems` is **gone**.

- [ ] **Step 2: Update the queries barrel `index.ts`**

In `FrontEnd/src/hooks/queries/index.ts`, find the existing block:

```typescript
export {
  useShoppingList,
  useAddShoppingItem,
  useToggleShoppingItemBought,
  useDeleteShoppingItem,
  useClearBoughtShoppingItems,
} from './useShoppingListQueries';
```

Replace with:

```typescript
export {
  useShoppingList,
  useAddShoppingItem,
  useUpdateShoppingItem,
  useToggleShoppingItemBought,
  useArchiveShoppingItem,
  useRestoreShoppingItem,
  useDeleteShoppingItem,
  useArchiveBoughtShoppingItems,
  useArchivedHistory,
} from './useShoppingListQueries';
```

- [ ] **Step 3: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: errors will now include callers of `useClearBoughtShoppingItems` (in `ShoppingListPage.tsx`) — that's expected. Tasks 17 fixes that. No NEW unrelated errors.

---

## Phase C — Form & list components

### Task 12: AddShoppingItemForm — add category dropdown + edit-mode

**Files:**
- Modify: `FrontEnd/src/components/dashboard/shared/AddShoppingItemForm.tsx`

This component now serves both add AND edit modes, mirroring `AddExpenseForm.expense?` pattern.

- [ ] **Step 1: Replace the file with the v2 version**

Overwrite with EXACTLY this:

```tsx
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { extractApiError } from '@/utils/extractApiError';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddShoppingItem, useUpdateShoppingItem } from '@/hooks/queries';
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface AddShoppingItemFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  item?: ShoppingListItemResponse;  // present in edit mode
}

export default function AddShoppingItemForm({
  open,
  onOpenChange,
  householdId,
  item,
}: AddShoppingItemFormProps) {
  const isEditMode = item !== undefined;

  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [category, setCategory] = useState<ExpenseType>(item?.category ?? 'groceries');
  const [error, setError] = useState<string | null>(null);

  const addMutation = useAddShoppingItem(householdId);
  const updateMutation = useUpdateShoppingItem(householdId);
  const submitting = addMutation.isPending || updateMutation.isPending;

  // Hydrate from `item` when it changes (parent switches between edit targets) or when sheet opens
  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity ?? '');
      setNotes(item.notes ?? '');
      setCategory(item.category);
      setError(null);
      return;
    }
    if (!open) {
      setName('');
      setQuantity('');
      setNotes('');
      setCategory('groceries');
      setError(null);
    }
  }, [item, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }

    try {
      if (isEditMode && item) {
        await updateMutation.mutateAsync({
          itemId: item._id,
          input: {
            name: trimmed,
            quantity: quantity.trim(),
            notes: notes.trim(),
            category,
          },
        });
      } else {
        await addMutation.mutateAsync({
          name: trimmed,
          ...(quantity.trim() && { quantity: quantity.trim() }),
          ...(notes.trim() && { notes: notes.trim() }),
          category,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err, isEditMode ? 'Failed to update item' : 'Failed to add item'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit shopping item' : 'Add shopping item'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="shop-name" className="block text-sm font-medium mb-1">Name</label>
            <Input
              id="shop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. milk"
              maxLength={100}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="shop-qty" className="block text-sm font-medium mb-1">Quantity (optional)</label>
            <Input
              id="shop-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2L, 1 dozen"
              maxLength={50}
            />
          </div>

          <div>
            <label htmlFor="shop-cat" className="block text-sm font-medium mb-1">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseType)}>
              <SelectTrigger id="shop-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="shop-notes" className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              id="shop-notes"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. whole milk only"
            />
          </div>

          {error && <p className="text-sm text-neg">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Save changes' : 'Add item'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: same errors about ShoppingListPage's old wiring — no new ones from this file.

---

### Task 13: ShoppingListView — category badge + 3-icon column

**Files:**
- Modify: `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx`

- [ ] **Step 1: Replace with v2 version**

Overwrite with EXACTLY this:

```tsx
import { Pencil, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useToggleShoppingItemBought,
  useArchiveShoppingItem,
  useDeleteShoppingItem,
} from '@/hooks/queries';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface ShoppingListViewProps {
  householdId: string;
  items: ShoppingListItemResponse[];
  onEditItem: (item: ShoppingListItemResponse) => void;
}

export default function ShoppingListView({ householdId, items, onEditItem }: ShoppingListViewProps) {
  const toggle = useToggleShoppingItemBought(householdId);
  const archive = useArchiveShoppingItem(householdId);
  const remove = useDeleteShoppingItem(householdId);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Your shopping list is empty. Add an item to get started.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {items.map((item) => (
        <li key={item._id} className="flex items-center gap-3 p-3">
          <input
            type="checkbox"
            checked={item.isBought}
            onChange={() => toggle.mutate(item._id)}
            className="h-4 w-4 cursor-pointer"
            aria-label={`Mark ${item.name} as bought`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm ${item.isBought ? 'line-through text-muted-foreground' : ''}`}>
                {item.quantity ? `${item.quantity} ` : ''}
                {item.name}
              </p>
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {EXPENSE_TYPE_LABELS[item.category]}
              </span>
            </div>
            {item.notes && (
              <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEditItem(item)}
            aria-label={`Edit ${item.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => archive.mutate(item._id)}
            aria-label={`Archive ${item.name}`}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove.mutate(item._id)}
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: callers may need updating to pass `onEditItem`. ShoppingListPage will be fixed in Task 17.

---

## Phase D — History view + utilities

### Task 14: useBeforeUnload hook

**Files:**
- Create: `FrontEnd/src/hooks/useBeforeUnload.ts`

- [ ] **Step 1: Create the file**

Create `FrontEnd/src/hooks/useBeforeUnload.ts` with EXACTLY this content:

```typescript
import { useEffect } from 'react';

/**
 * Registers a `beforeunload` listener while `active` is true.
 * Catches tab close, hard refresh, and direct URL changes.
 * Modern browsers ignore custom message strings — the browser shows its own confirm dialog.
 *
 * Does NOT catch browser back/forward arrow buttons (would require React Router data router + useBlocker).
 * Does NOT catch in-app `<Link>` clicks (already handled by `useGuardedNavClick` in AppLayout).
 */
export function useBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: no new errors from this file.

---

### Task 15: computeDominantCategory utility

**Files:**
- Create: `FrontEnd/src/utils/computeDominantCategory.ts`

- [ ] **Step 1: Create the file**

Create `FrontEnd/src/utils/computeDominantCategory.ts` with EXACTLY this content:

```typescript
import type { ExpenseType } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

/**
 * Compute the dominant category across a list of items.
 * Ties are broken by the earliest `createdAt` of items in the tied categories.
 *
 * Returns 'groceries' if `items` is empty.
 */
export function computeDominantCategory(items: ShoppingListItemResponse[]): ExpenseType {
  if (items.length === 0) return 'groceries';

  // Count items per category
  const counts = new Map<ExpenseType, number>();
  // Track earliest createdAt per category for tie-breaking
  const earliest = new Map<ExpenseType, string>();

  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    const prev = earliest.get(item.category);
    if (!prev || item.createdAt < prev) {
      earliest.set(item.category, item.createdAt);
    }
  }

  // Find category with max count; ties → earliest createdAt
  let winner: ExpenseType = 'groceries';
  let winnerCount = 0;
  let winnerEarliest = '￿';  // sentinel — any real ISO date sorts before this

  for (const [category, count] of counts) {
    const earliestForCat = earliest.get(category)!;
    if (count > winnerCount) {
      winner = category;
      winnerCount = count;
      winnerEarliest = earliestForCat;
    } else if (count === winnerCount && earliestForCat < winnerEarliest) {
      winner = category;
      winnerEarliest = earliestForCat;
    }
  }

  return winner;
}
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes for this file.

---

### Task 16: ShoppingHistoryView component

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/ShoppingHistoryView.tsx`

This is the largest new piece — read carefully.

- [ ] **Step 1: Create the file**

Create `FrontEnd/src/components/dashboard/shared/ShoppingHistoryView.tsx` with EXACTLY this content:

```tsx
import { useNavigate } from 'react-router-dom';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useArchivedHistory,
  useRestoreShoppingItem,
  useDeleteShoppingItem,
} from '@/hooks/queries';
import { EXPENSE_TYPE_LABELS } from '@/types/onboarding.types';
import type { HistoryEntry } from '@/types/shoppingList.types';

interface ShoppingHistoryViewProps {
  householdId: string;
}

export default function ShoppingHistoryView({ householdId }: ShoppingHistoryViewProps) {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useArchivedHistory(householdId);

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
    // Sequentially delete each item in the entry so we observe failures.
    Promise.all(entry.items.map((i) => remove.mutateAsync(i._id))).catch(() => {
      // Errors are surfaced by the mutation's onError; no extra handling needed here.
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
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: no new errors from this file.

---

## Phase E — Page wiring & dialog update

### Task 17: ShoppingListPage — Tabs, edit state, beforeunload, archiveBought wiring

**Files:**
- Modify: `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`

This is the biggest frontend integration task — touches every v2 piece.

- [ ] **Step 1: Confirm shadcn `Tabs` is available**

```bash
ls FrontEnd/src/components/ui/ | grep -i tabs
```

If `tabs.tsx` exists, you're good. If not, search for it being installed elsewhere. If completely missing, install via shadcn CLI (`npx shadcn-ui@latest add tabs`) — but first check if it's already installed under a different name.

- [ ] **Step 2: Replace the page file with the v2 version**

Overwrite `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx` with EXACTLY this:

```tsx
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
    // Group items by category preserving first-seen order
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

  // Push bought-count into context (sidebar leave-guard) AND drive useBeforeUnload below
  useEffect(() => {
    setShoppingListBoughtCount(boughtItems.length);
    return () => setShoppingListBoughtCount(0);
  }, [boughtItems.length, setShoppingListBoughtCount]);

  // Register the convert handler so AppLayout's leave-guard can trigger it
  useEffect(() => {
    setShoppingListConvertHandler(() => handleConvertConfirm);
    return () => setShoppingListConvertHandler(null);
  }, [setShoppingListConvertHandler, handleConvertConfirm]);

  // Hard nav guard via beforeunload — covers tab close / hard refresh / direct URL change
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
```

- [ ] **Step 3: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: still one outstanding error from `DoneShoppingDialog` not yet accepting `dominantCategory` — Task 18 fixes that. Otherwise clean.

---

### Task 18: DoneShoppingDialog — group items by category + dominant-category copy

**Files:**
- Modify: `FrontEnd/src/components/dashboard/shared/DoneShoppingDialog.tsx`

- [ ] **Step 1: Replace with v2 version**

Overwrite with EXACTLY this:

```tsx
import { Button } from '@/components/ui/button';
import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/types/onboarding.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface DoneShoppingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boughtItems: ShoppingListItemResponse[];
  dominantCategory: ExpenseType;
  onConfirm: () => void;
}

export default function DoneShoppingDialog({
  open,
  onOpenChange,
  boughtItems,
  dominantCategory,
  onConfirm,
}: DoneShoppingDialogProps) {
  if (!open) return null;

  // Group items by category in first-seen order for display
  const grouped = new Map<ExpenseType, ShoppingListItemResponse[]>();
  for (const item of boughtItems) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category)!.push(item);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Done shopping?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {boughtItems.length === 1
            ? `We'll convert this 1 bought item into a single ${EXPENSE_TYPE_LABELS[dominantCategory].toUpperCase()} expense.`
            : `We'll convert these ${boughtItems.length} bought items into a single ${EXPENSE_TYPE_LABELS[dominantCategory].toUpperCase()} expense.`}
        </p>

        <div className="mt-4 max-h-48 space-y-3 overflow-auto rounded-md border bg-card p-3 text-sm">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                {EXPENSE_TYPE_LABELS[cat]}
              </p>
              <ul className="mt-1 space-y-0.5">
                {items.map((item) => (
                  <li key={item._id}>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Open expense form
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: clean now. Zero errors.

- [ ] **Step 3: Build (catches deeper TS issues)**

```bash
cd FrontEnd && npm run build
```

Expected: build succeeds. May take 30-60 seconds.

---

## Phase F — Final verification

### Task 19: End-to-end manual verification + lint

- [ ] **Step 1: Type-check both packages**

```bash
cd BackEnd && npm run type-check && cd ../FrontEnd && npx tsc --noEmit
```

Expected: both pass with no errors.

- [ ] **Step 2: Lint frontend**

```bash
cd FrontEnd && npm run lint
```

Expected: no NEW warnings or errors compared to before this work. (Pre-existing v1 / unrelated issues are acceptable.)

- [ ] **Step 3: Build frontend**

```bash
cd FrontEnd && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: End-to-end UI walkthrough**

Two browser profiles (or private + regular window) logged into the two members of a couple-mode household. Backend should be running (Task 0 already done).

**Active tab — categories + edit:**
1. Member A adds 3 items via "+ Add item":
   - "milk" qty "2L" category "Groceries"
   - "sponge" category "Cleaning"
   - "internet bill" category "Internet"
2. Verify each row shows the category badge.
3. Member A clicks pencil on "milk" → edit form opens prefilled. Change name to "whole milk", change qty to "1L", change category to "Other". Save.
4. Verify the row updates immediately (badge reads "Other", text reads "1L whole milk").

**Manual archive + restore:**
5. Member A clicks archive icon on "sponge" → it disappears from Active.
6. Switch to History tab → "sponge" appears as a manual entry with Restore button.
7. Click Restore → switch back to Active → "sponge" is visible (unchecked).

**Conversion archive (Done shopping):**
8. Member A checks "milk" and "sponge" as bought. Member B is online and refreshes — sees the same.
9. Click "Done shopping". Confirmation modal copy reads "We'll convert these 2 bought items into a single GROCERIES expense." (Or CLEANING if cleaning has the earliest createdAt — confirm whichever wins per spec rule.)
10. Click "Open expense form" → AddExpenseForm opens with description = `"GROCERIES: 1L whole milk · CLEANING: sponge"` (or similar), category set to dominant (Groceries here), date today, paid-by Member A, amount empty.
11. Enter £20, save.
12. Verify the expense appears in `/dashboard/expenses` tab.
13. Switch to History tab — a new TRIP card at the top showing "2 items · GROCERIES · View expense", with both items listed and category badges.
14. Click "View expense" link → routes to `/dashboard/expenses`.

**Restore conversion archive — should fail:**
15. Manually call (via curl or browser dev console) `POST /shopping-list/<itemId>/restore` on the trip's item ID → expect 400.

**Pagination:**
16. Repeat steps 1–11 ten more times so that History has > 10 entries. (In dev, you can use the curl to seed faster.)
17. History tab loads first 10 entries + a "Load more" button. Click → next 10 (or remainder) load.
18. When `nextCursor === null`, "Load more" hides.

**Hard guard — beforeunload:**
19. With at least one bought item on the active list, hit Ctrl+R → browser shows "Leave site? Changes you made may not be saved" confirm. Cancel keeps you on the page.
20. Try to close the tab → same confirm.
21. Uncheck the bought item → try to refresh → no confirm (count is 0).

**Mobile:**
22. Switch to mobile viewport. Tabs work. Bottom nav works. "Load more" tappable. 3-icon column on each row remains usable.

**Roommate dashboard:**
23. (If you have a non-couple test account) Log in → Shopping nav still hidden.

- [ ] **Step 5: Regression — existing v1 flows unchanged**

In Expenses tab: add a new expense via the regular flow, edit it, delete it. Confirm AddExpenseForm still works for non-shopping use cases.

If anything fails, document it as an issue, do not silently patch — escalate to the controller.

---

## Spec coverage map

| Spec section | Implemented in |
|---|---|
| Item carries `category` (required, default 'groceries') | Tasks 1, 2, 3, 4, 8, 12 |
| Archive fields on model (`archivedAt`, `archivedExpenseId`, `archivedDominantCategory`) | Tasks 1, 2 |
| Index `(householdId, archivedAt)` | Task 2 |
| `updateItem` service + `PATCH /:itemId` route + validator + frontend hook + form edit mode | Tasks 3, 4, 5, 6, 11, 12 |
| `archiveItem` service + `POST /:itemId/archive` + frontend hook + UI affordance | Tasks 4, 5, 6, 11, 13 |
| `restoreItem` service (refuses conversion archives) + `POST /:itemId/restore` + frontend hook + history UI | Tasks 4, 5, 6, 11, 16 |
| `archiveBought` replacing `clearBought` (with `expenseId` + `dominantCategory`) | Tasks 4, 5, 6, 10, 11, 17 |
| `listArchivedHistory` with cursor pagination + server-side trip grouping | Tasks 4, 5, 6 |
| ShoppingListView 3-icon column + category badge + onEditItem callback | Task 13 |
| AddShoppingItemForm category dropdown + edit mode | Task 12 |
| DoneShoppingDialog grouped items + dominant category copy | Task 18 |
| ShoppingHistoryView (trip card + manual card + Load more) | Task 16 |
| ShoppingListPage Tabs (Active / History) + editingItem state + dominantCategory wiring | Task 17 |
| computeDominantCategory util (ties broken by earliest createdAt) | Task 15 |
| useBeforeUnload hook (covers tab close / refresh / URL change) | Task 14 |
| Page wires `useBeforeUnload(boughtItems.length > 0)` | Task 17 |
| EXPENSE_TYPE_LABELS for friendly category names | Task 7 |

All YAGNI items from the spec ("Out of Scope for v2") are correctly absent: no router migration / browser back guard, no bulk archive, no search/filter, no auto-prune, no per-item price, no restore for conversion archives.

---

## Notes for the implementer

- **Backend first.** Phase A must complete before Phase B. The frontend type errors during Phase B are EXPECTED until Phase E wires the page; do not chase them mid-phase.
- **`clearBought` → `archiveBought` is a free swap** because v1 was on the same branch and never deployed. No backwards-compat alias.
- **The `editingItem` + `addOpen` interplay**: `AddShoppingItemForm.open` is `true` when EITHER `addOpen` OR `editingItem !== null`. When closed, both states clear. The form internally distinguishes mode via `item !== undefined`.
- **`computeDominantCategory` is called twice on the page**: once for the prefilled expense's `category`, once when calling `archiveBought`. Both reads happen within the same render cycle so they always agree.
- **Hard delete of a trip from history** does N parallel `deleteItem` calls. For a typical trip (3-10 items) this is fine. If trips routinely had hundreds of items, a dedicated bulk endpoint would be warranted — out of scope for v2.
- **The migration concern**: dev DB items from v1 don't have `category`. Mongoose's schema default fills it on read, so existing items appear as "Groceries" until inline-edited. No code-side migration needed for the masters-project workflow. If you want clean data, run the one-shot `updateMany` from the spec via mongosh.
