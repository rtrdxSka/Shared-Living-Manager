# Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared Shopping List tab to the couple dashboard that converts checked-off items into a single pre-filled expense in one action.

**Architecture:** Mirror the Tasks feature stack end-to-end (model → service → controller → routes → frontend types → API → hooks → components → page). One new MongoDB collection (`shoppinglistitems`), one new dashboard route (`/dashboard/shopping-list`), one extended component (`AddExpenseForm` gains an `initialValues` prop). The "tab-leave" safety net intercepts in-app sidebar clicks via shared dirty state in `DashboardContext` (the codebase uses `<BrowserRouter>`, so `useBlocker` is unavailable).

**Tech Stack:** Backend — Node.js + Express + TypeScript + Mongoose. Frontend — React + TypeScript + Vite + TanStack Query + shadcn/ui (Sheet primitives + hand-rolled modals).

**Reference spec:** `/home/mitev_kristian/.claude/plans/hey-bro-today-i-clever-alpaca.md` (move to `docs/superpowers/specs/2026-04-30-shopping-list-design.md` as Pre-flight Task 0 below).

**Test infrastructure note:** The repo currently has no test runner configured (`BackEnd/package.json` `npm run test` echoes an error; `FrontEnd/package.json` has no test script). Adding test infrastructure is out of scope for this feature. Each task therefore uses **manual verification gates** — `npm run type-check` / `npm run build` for type safety, plus targeted curl flows or in-browser walkthroughs to verify behaviour. Frequent commits and review-after-each-task discipline are preserved.

---

## Phase Overview

| Phase | Tasks | Output |
|---|---|---|
| 0 — Pre-flight | 0 | Spec moved to canonical location |
| A — Backend | 1 – 7 | Working `/api/households/:id/shopping-list` endpoints |
| B — Frontend data layer | 8 – 12 | Types, API client, query hooks, barrel export |
| C — Frontend components | 13 – 16 | All 4 UI components built in isolation |
| D — Expense form extension | 17 | `AddExpenseForm` accepts `initialValues` |
| E — Page + wiring | 18 – 22 | Tab visible in nav for couples; primary "Done shopping" flow works end-to-end |
| F — Leave-guard + final verification | 23 – 24 | Sidebar interception works; all manual checks pass |

---

## Task 0: Move spec into canonical location

**Files:**
- Move: `/home/mitev_kristian/.claude/plans/hey-bro-today-i-clever-alpaca.md` → `docs/superpowers/specs/2026-04-30-shopping-list-design.md`

- [ ] **Step 1: Create the specs directory if it doesn't exist**

```bash
mkdir -p docs/superpowers/specs
```

- [ ] **Step 2: Copy the spec into the repo**

```bash
cp /home/mitev_kristian/.claude/plans/hey-bro-today-i-clever-alpaca.md docs/superpowers/specs/2026-04-30-shopping-list-design.md
```

- [ ] **Step 3: Commit the spec**

```bash
git add docs/superpowers/specs/2026-04-30-shopping-list-design.md docs/superpowers/plans/2026-04-30-shopping-list.md
git commit -m "docs: add shopping-list design spec and implementation plan"
```

---

## Phase A — Backend

### Task 1: Backend types

**Files:**
- Create: `BackEnd/src/types/shopping-list.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
import { Document, Types } from 'mongoose';

export interface IShoppingListItem extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  quantity?: string;
  notes?: string;
  addedByUserId: Types.ObjectId;
  isBought: boolean;
  boughtAt?: Date;
  boughtByMemberId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
}

export interface IShoppingListItemResponse {
  _id: string;
  householdId: string;
  name: string;
  quantity?: string;
  notes?: string;
  addedByUserId: string;
  isBought: boolean;
  boughtAt?: string;
  boughtByMemberId?: string;
  boughtByNickname?: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes (no errors).

- [ ] **Step 3: Commit**

```bash
git add BackEnd/src/types/shopping-list.types.ts
git commit -m "feat(backend): add shopping-list type definitions"
```

---

### Task 2: Backend Mongoose model

**Files:**
- Create: `BackEnd/src/models/shopping-list-item.model.ts`

- [ ] **Step 1: Create the model file**

```typescript
import { Schema, model } from 'mongoose';
import { IShoppingListItem } from '../types/shopping-list.types';

const shoppingListItemSchema = new Schema<IShoppingListItem>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    quantity: { type: String, trim: true, maxlength: 50, default: undefined },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
    addedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isBought: { type: Boolean, default: false },
    boughtAt: { type: Date, default: undefined },
    boughtByMemberId: { type: Schema.Types.ObjectId, default: undefined },
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

export const ShoppingListItem = model<IShoppingListItem>('ShoppingListItem', shoppingListItemSchema);
```

- [ ] **Step 2: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add BackEnd/src/models/shopping-list-item.model.ts
git commit -m "feat(backend): add ShoppingListItem mongoose model"
```

---

### Task 3: Backend validators

**Files:**
- Create: `BackEnd/src/validators/shopping-list.validator.ts`

- [ ] **Step 1: Create the validator file**

```typescript
import { body, param, ValidationChain } from 'express-validator';

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
```

- [ ] **Step 2: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add BackEnd/src/validators/shopping-list.validator.ts
git commit -m "feat(backend): add shopping-list request validators"
```

---

### Task 4: Backend service

**Files:**
- Create: `BackEnd/src/services/shopping-list.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
import { Types } from 'mongoose';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import {
  IShoppingListItem,
  IAddShoppingItemInput,
  IShoppingListItemResponse,
} from '../types/shopping-list.types';
import { NotFoundError } from '../utils/error';
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
      addedByUserId: userId,
    });

    return this.formatResponse(item);
  }

  async listItems(
    householdId: string,
    userId: string
  ): Promise<{ items: IShoppingListItemResponse[] }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const items = await ShoppingListItem.find({ householdId: household._id })
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

  async clearBought(
    householdId: string,
    userId: string
  ): Promise<{ deletedCount: number }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const result = await ShoppingListItem.deleteMany({
      householdId: household._id,
      isBought: true,
    });

    return { deletedCount: result.deletedCount ?? 0 };
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
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  // Used when documents come from .lean() (plain objects, not hydrated Mongoose docs).
  private formatLeanResponse(
    item: Record<string, unknown> & {
      _id: Types.ObjectId;
      householdId: Types.ObjectId;
      name: string;
      quantity?: string;
      notes?: string;
      addedByUserId: Types.ObjectId;
      isBought: boolean;
      boughtAt?: Date;
      boughtByMemberId?: Types.ObjectId;
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
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export const shoppingListService = new ShoppingListService();
```

- [ ] **Step 2: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add BackEnd/src/services/shopping-list.service.ts
git commit -m "feat(backend): add ShoppingListService with CRUD + clearBought"
```

---

### Task 5: Backend controller

**Files:**
- Create: `BackEnd/src/controllers/shopping-list.controller.ts`

- [ ] **Step 1: Create the controller file**

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { shoppingListService } from '../services/shopping-list.service';
import { IAddShoppingItemInput } from '../types/shopping-list.types';

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
      const result = await shoppingListService.listItems(householdId, req.user.userId);

      res.status(200).json({ status: 'success', data: result });
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

  // POST /api/households/:id/shopping-list/clear-bought
  async clearBought(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const result = await shoppingListService.clearBought(householdId, req.user.userId);

      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const shoppingListController = new ShoppingListController();
```

- [ ] **Step 2: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add BackEnd/src/controllers/shopping-list.controller.ts
git commit -m "feat(backend): add ShoppingListController"
```

---

### Task 6: Backend routes file

**Files:**
- Create: `BackEnd/src/routes/shopping-list.routes.ts`

- [ ] **Step 1: Create the routes file**

```typescript
import { Router } from 'express';
import { shoppingListController } from '../controllers/shopping-list.controller';
import {
  addShoppingItemValidation,
  shoppingItemIdValidation,
  householdIdOnlyValidation,
} from '../validators/shopping-list.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true }); // exposes :id from household router

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

// POST /api/households/:id/shopping-list/clear-bought — must come before /:itemId routes
router.post(
  '/clear-bought',
  authMiddleware,
  emailVerifiedMiddleware,
  householdIdOnlyValidation,
  handleValidationErrors,
  shoppingListController.clearBought.bind(shoppingListController)
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

- [ ] **Step 2: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add BackEnd/src/routes/shopping-list.routes.ts
git commit -m "feat(backend): add shopping-list router"
```

---

### Task 7: Mount routes in household router + curl smoke test

**Files:**
- Modify: `BackEnd/src/routes/household.routes.ts`

- [ ] **Step 1: Add the import alongside the other sub-routers**

In `BackEnd/src/routes/household.routes.ts` near the top (around lines 7-12), add:

```typescript
import shoppingListRouter from './shopping-list.routes';
```

- [ ] **Step 2: Mount the router at the end of the file (next to where `taskRouter` is mounted)**

Find the line `router.use('/:id/tasks', taskRouter);` (or equivalent for tasks). Below that line, add:

```typescript
router.use('/:id/shopping-list', shoppingListRouter);
```

- [ ] **Step 3: Type-check**

```bash
cd BackEnd && npm run type-check
```

Expected: passes.

- [ ] **Step 4: Start the dev server**

```bash
cd BackEnd && npm run dev
```

Wait for "Server listening on port..." log. Keep this terminal open.

- [ ] **Step 5: Run a curl smoke test from a second terminal**

You need a real JWT and an existing household ID for an account that's a member. Replace `$TOKEN` and `$HID` in the snippet below.

```bash
TOKEN="<paste-jwt-from-browser-localStorage>"
HID="<paste-household-id-from-browser-localStorage>"

# Add an item
curl -i -X POST "http://localhost:3000/api/households/$HID/shopping-list" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"milk","quantity":"2L"}'

# List items
curl -i "http://localhost:3000/api/households/$HID/shopping-list" \
  -H "Authorization: Bearer $TOKEN"

# Toggle bought (paste the _id from the create response into ITEM_ID)
ITEM_ID="<paste-id>"
curl -i -X PATCH "http://localhost:3000/api/households/$HID/shopping-list/$ITEM_ID/bought" \
  -H "Authorization: Bearer $TOKEN"

# Clear bought
curl -i -X POST "http://localhost:3000/api/households/$HID/shopping-list/clear-bought" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- `POST` returns `201` with `{ status: 'success', data: { item: {...} } }`
- `GET` returns `200` with `{ status: 'success', data: { items: [...] } }`
- `PATCH /bought` returns `200`, `isBought: true` in response
- `POST /clear-bought` returns `200` with `{ deletedCount: 1 }` (or however many were bought)

- [ ] **Step 6: Stop the dev server (Ctrl-C in the first terminal)**

- [ ] **Step 7: Commit the routing change**

```bash
git add BackEnd/src/routes/household.routes.ts
git commit -m "feat(backend): mount shopping-list router under household"
```

---

## Phase B — Frontend data layer

### Task 8: Add `shoppingList` entry to queryKeys factory

**Files:**
- Modify: `FrontEnd/src/lib/queryKeys.ts`

- [ ] **Step 1: Add a new entry inside the `queryKeys` object, right before the closing `} as const;`**

```typescript
  shoppingList: {
    all: (householdId: string) => ['shoppingList', householdId] as const,
    list: (householdId: string) => ['shoppingList', householdId, 'list'] as const,
  },
```

The full keys object should now have a `shoppingList` block sitting next to `tasks`, `goals`, etc.

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/lib/queryKeys.ts
git commit -m "feat(frontend): add shoppingList query keys"
```

---

### Task 9: Frontend types

**Files:**
- Create: `FrontEnd/src/types/shoppingList.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
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
  boughtByNickname?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
}
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/types/shoppingList.types.ts
git commit -m "feat(frontend): add shopping-list types"
```

---

### Task 10: Frontend API client

**Files:**
- Create: `FrontEnd/src/api/shoppingList.api.ts`

- [ ] **Step 1: Create the API client**

```typescript
import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type { ShoppingListItemResponse, AddShoppingItemInput } from '@/types/shoppingList.types';

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

  async toggleBought(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/bought`
    );
    return data.data.item;
  },

  async deleteItem(householdId: string, itemId: string): Promise<void> {
    await api.delete(`/households/${householdId}/shopping-list/${itemId}`);
  },

  async clearBought(householdId: string): Promise<{ deletedCount: number }> {
    const { data } = await api.post<ApiSuccessResponse<{ deletedCount: number }>>(
      `/households/${householdId}/shopping-list/clear-bought`
    );
    return data.data;
  },
};
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/api/shoppingList.api.ts
git commit -m "feat(frontend): add shopping-list API client"
```

---

### Task 11: Frontend query hooks

**Files:**
- Create: `FrontEnd/src/hooks/queries/useShoppingListQueries.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shoppingListApi, type ShoppingListResult } from '@/api/shoppingList.api';
import type { ShoppingListItemResponse, AddShoppingItemInput } from '@/types/shoppingList.types';
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

export function useDeleteShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (itemId: string) => shoppingListApi.deleteItem(householdId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useClearBoughtShoppingItems(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ deletedCount: number }, Error, void>({
    mutationFn: () => shoppingListApi.clearBought(householdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/hooks/queries/useShoppingListQueries.ts
git commit -m "feat(frontend): add shopping-list query hooks"
```

---

### Task 12: Re-export hooks from the queries barrel

**Files:**
- Modify: `FrontEnd/src/hooks/queries/index.ts`

- [ ] **Step 1: Add a new export block at the bottom of the file**

Append (after the last existing export block):

```typescript
export {
  useShoppingList,
  useAddShoppingItem,
  useToggleShoppingItemBought,
  useDeleteShoppingItem,
  useClearBoughtShoppingItems,
} from './useShoppingListQueries';
```

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/hooks/queries/index.ts
git commit -m "feat(frontend): re-export shopping-list query hooks"
```

---

## Phase C — Frontend components

### Task 13: AddShoppingItemForm

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/AddShoppingItemForm.tsx`

- [ ] **Step 1: Create the form component**

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddShoppingItem } from '@/hooks/queries';

interface AddShoppingItemFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
}

export default function AddShoppingItemForm({
  open,
  onOpenChange,
  householdId,
}: AddShoppingItemFormProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addMutation = useAddShoppingItem(householdId);
  const submitting = addMutation.isPending;

  // Reset form when the sheet closes
  useEffect(() => {
    if (!open) {
      setName('');
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }

    try {
      await addMutation.mutateAsync({
        name: trimmed,
        ...(quantity.trim() && { quantity: quantity.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
      });
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err) ?? 'Failed to add item');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add shopping item</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="shop-name" className="block text-sm font-medium mb-1">
              Name
            </label>
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
            <label htmlFor="shop-qty" className="block text-sm font-medium mb-1">
              Quantity (optional)
            </label>
            <Input
              id="shop-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2L, 1 dozen"
              maxLength={50}
            />
          </div>

          <div>
            <label htmlFor="shop-notes" className="block text-sm font-medium mb-1">
              Notes (optional)
            </label>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add item
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

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/components/dashboard/shared/AddShoppingItemForm.tsx
git commit -m "feat(frontend): add AddShoppingItemForm sheet"
```

---

### Task 14: ShoppingListView

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx`

- [ ] **Step 1: Create the list component**

```tsx
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useToggleShoppingItemBought,
  useDeleteShoppingItem,
} from '@/hooks/queries';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface ShoppingListViewProps {
  householdId: string;
  items: ShoppingListItemResponse[];
}

export default function ShoppingListView({ householdId, items }: ShoppingListViewProps) {
  const toggle = useToggleShoppingItemBought(householdId);
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
            <p className={`text-sm ${item.isBought ? 'line-through text-muted-foreground' : ''}`}>
              {item.quantity ? `${item.quantity} ` : ''}
              {item.name}
            </p>
            {item.notes && (
              <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
            )}
          </div>
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

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/components/dashboard/shared/ShoppingListView.tsx
git commit -m "feat(frontend): add ShoppingListView component"
```

---

### Task 15: DoneShoppingDialog

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/DoneShoppingDialog.tsx`

- [ ] **Step 1: Create the dialog**

```tsx
import { Button } from '@/components/ui/button';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

interface DoneShoppingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boughtItems: ShoppingListItemResponse[];
  onConfirm: () => void;
}

export default function DoneShoppingDialog({
  open,
  onOpenChange,
  boughtItems,
  onConfirm,
}: DoneShoppingDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Done shopping?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {boughtItems.length === 1
            ? "We'll convert this 1 bought item into an expense."
            : `We'll convert these ${boughtItems.length} bought items into a single expense.`}
        </p>

        <ul className="mt-4 max-h-48 space-y-1 overflow-auto rounded-md border bg-card p-3 text-sm">
          {boughtItems.map((item) => (
            <li key={item._id}>
              {item.quantity ? `${item.quantity} ` : ''}
              {item.name}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
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

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/components/dashboard/shared/DoneShoppingDialog.tsx
git commit -m "feat(frontend): add DoneShoppingDialog confirmation modal"
```

---

### Task 16: LeaveShoppingPromptDialog

**Files:**
- Create: `FrontEnd/src/components/dashboard/shared/LeaveShoppingPromptDialog.tsx`

- [ ] **Step 1: Create the leave-prompt dialog**

```tsx
import { Button } from '@/components/ui/button';

interface LeaveShoppingPromptDialogProps {
  open: boolean;
  boughtCount: number;
  onConvertNow: () => void;
  onLeaveAnyway: () => void;
}

export default function LeaveShoppingPromptDialog({
  open,
  boughtCount,
  onConvertNow,
  onLeaveAnyway,
}: LeaveShoppingPromptDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Hold on — shopping not finished?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You have {boughtCount} bought {boughtCount === 1 ? 'item' : 'items'} that haven't been logged as an expense yet. Convert them now or leave them on the list?
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onLeaveAnyway}>
            Leave anyway
          </Button>
          <Button onClick={onConvertNow}>Convert now</Button>
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

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/components/dashboard/shared/LeaveShoppingPromptDialog.tsx
git commit -m "feat(frontend): add LeaveShoppingPromptDialog"
```

---

## Phase D — Expense form extension

### Task 17: Add `initialValues` prop to AddExpenseForm

**Files:**
- Modify: `FrontEnd/src/components/dashboard/shared/AddExpenseForm.tsx`

- [ ] **Step 1: Re-read the existing file to confirm exact line numbers before editing**

```bash
wc -l FrontEnd/src/components/dashboard/shared/AddExpenseForm.tsx
```

Note where the props interface, useState block, and reset useEffect live — these are the three sections you'll edit.

- [ ] **Step 2: Update the props interface**

Find:

```typescript
interface AddExpenseFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  household: HouseholdResponse;
  expense?: ExpenseResponse;
  isAdmin: boolean;
  currentUserId: string;
}
```

Replace with:

```typescript
interface AddExpenseFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  household: HouseholdResponse;
  expense?: ExpenseResponse;
  isAdmin: boolean;
  currentUserId: string;
  initialValues?: Partial<AddExpenseInput>;  // prefill in create mode (ignored when `expense` is provided)
  onCreated?: (expense: ExpenseResponse) => void;  // optional callback fired after a successful create
}
```

- [ ] **Step 3: Add `initialValues` and `onCreated` to the destructured props**

Find:

```typescript
export default function AddExpenseForm({
  open,
  onOpenChange,
  household,
  expense,
  isAdmin,
  currentUserId,
}: AddExpenseFormProps) {
```

Replace with:

```typescript
export default function AddExpenseForm({
  open,
  onOpenChange,
  household,
  expense,
  isAdmin,
  currentUserId,
  initialValues,
  onCreated,
}: AddExpenseFormProps) {
```

- [ ] **Step 4: Update the useState initializers to fall back to `initialValues` when `expense` is undefined**

Find the block (around lines 51-58):

```typescript
const [description, setDescription] = useState(expense?.description ?? '');
const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
const [category, setCategory] = useState(expense?.category ?? EXPENSE_TYPES[0]);
const [date, setDate] = useState(expense ? expense.date.slice(0, 10) : todayISO());
const [paidByUserId, setPaidByUserId] = useState(expense?.paidByUserId ?? '');
const [notes, setNotes] = useState(expense?.notes ?? '');
const [splitMode, setSplitMode] = useState<'default' | 'full'>(expense?.isFullRepayment ? 'full' : 'default');
```

Replace with:

```typescript
const [description, setDescription] = useState(expense?.description ?? initialValues?.description ?? '');
const [amount, setAmount] = useState(
  expense ? String(expense.amount) : initialValues?.amount != null ? String(initialValues.amount) : ''
);
const [category, setCategory] = useState(expense?.category ?? initialValues?.category ?? EXPENSE_TYPES[0]);
const [date, setDate] = useState(
  expense ? expense.date.slice(0, 10) : (initialValues?.date ?? todayISO())
);
const [paidByUserId, setPaidByUserId] = useState(expense?.paidByUserId ?? initialValues?.paidByUserId ?? '');
const [notes, setNotes] = useState(expense?.notes ?? initialValues?.notes ?? '');
const [splitMode, setSplitMode] = useState<'default' | 'full'>(
  expense?.isFullRepayment ? 'full' : initialValues?.isFullRepayment ? 'full' : 'default'
);
```

- [ ] **Step 5: Update the re-population useEffect to also re-hydrate from `initialValues` when the sheet opens in create mode**

Find the existing `useEffect` that repopulates state when `expense` changes (the one starting near line 72: `useEffect(() => { if (expense) { ... } }, [expense]);`). Modify it to also handle `initialValues` on open.

Replace it with:

```typescript
// Re-populate form whenever the expense being edited or initialValues prefill changes,
// or when the sheet opens in create mode with prefill data.
useEffect(() => {
  if (expense) {
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setDate(expense.date.slice(0, 10));
    setPaidByUserId(expense.paidByUserId ?? '');
    setNotes(expense.notes ?? '');
    setSplitMode(expense.isFullRepayment ? 'full' : 'default');
    return;
  }
  if (open && initialValues) {
    if (initialValues.description !== undefined) setDescription(initialValues.description);
    if (initialValues.amount !== undefined) setAmount(String(initialValues.amount));
    if (initialValues.category !== undefined) setCategory(initialValues.category);
    if (initialValues.date !== undefined) setDate(initialValues.date);
    if (initialValues.paidByUserId !== undefined) setPaidByUserId(initialValues.paidByUserId);
    if (initialValues.notes !== undefined) setNotes(initialValues.notes);
    if (initialValues.isFullRepayment !== undefined) {
      setSplitMode(initialValues.isFullRepayment ? 'full' : 'default');
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [expense, open]);
```

- [ ] **Step 6: Fire `onCreated` after a successful create**

Locate the submit handler where `addExpenseMutation.mutateAsync(...)` is called (search for `addExpenseMutation.mutateAsync`). After the awaited call resolves with a created expense (and outside of any recurring-expense branch), add:

```typescript
if (onCreated) onCreated(created);
```

If the existing code doesn't capture the resolved value, refactor to:

```typescript
const created = await addExpenseMutation.mutateAsync(payload);
if (onCreated) onCreated(created);
```

(Adjust to match the existing variable names. Do not change existing behaviour for editing.)

- [ ] **Step 7: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 8: Manual sanity check that existing expense flows still work**

```bash
cd FrontEnd && npm run dev
```

Open the Expenses tab in the browser, add an expense, edit an expense — confirm both flows still work unchanged. Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add FrontEnd/src/components/dashboard/shared/AddExpenseForm.tsx
git commit -m "feat(frontend): add initialValues + onCreated props to AddExpenseForm"
```

---

## Phase E — Page + wiring

### Task 18: ShoppingListPage skeleton (without leave-guard yet)

**Files:**
- Create: `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useMemo, useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/DashboardContext';
import { useShoppingList, useClearBoughtShoppingItems } from '@/hooks/queries';
import AddShoppingItemForm from '@/components/dashboard/shared/AddShoppingItemForm';
import ShoppingListView from '@/components/dashboard/shared/ShoppingListView';
import DoneShoppingDialog from '@/components/dashboard/shared/DoneShoppingDialog';
import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import type { AddExpenseInput } from '@/types/expense.types';
import type { ShoppingListItemResponse } from '@/types/shoppingList.types';

export default function ShoppingListPage() {
  const { household, currentUserId, isAdmin } = useDashboard();
  const householdId = household._id;

  const { data, isLoading } = useShoppingList(householdId);
  const items = data?.items ?? [];
  const boughtItems = useMemo(() => items.filter((i) => i.isBought), [items]);
  const hasBought = boughtItems.length > 0;

  const clearBought = useClearBoughtShoppingItems(householdId);

  const [addOpen, setAddOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [expensePrefill, setExpensePrefill] = useState<Partial<AddExpenseInput> | null>(null);

  function buildPrefillFromBought(bought: ShoppingListItemResponse[]): Partial<AddExpenseInput> {
    const description = bought
      .map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name))
      .join(', ');
    return {
      description,
      paidByUserId: currentUserId,
      category: 'groceries',
      date: new Date().toISOString().slice(0, 10),
    };
  }

  function handleConvertConfirm() {
    setExpensePrefill(buildPrefillFromBought(boughtItems));
    setExpenseSheetOpen(true);
  }

  async function handleExpenseCreated() {
    await clearBought.mutateAsync();
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ShoppingListView householdId={householdId} items={items} />
      )}

      {hasBought && (
        <div className="sticky bottom-4 flex justify-end">
          <Button size="lg" onClick={() => setDoneOpen(true)}>
            Done shopping ({boughtItems.length})
          </Button>
        </div>
      )}

      <AddShoppingItemForm
        open={addOpen}
        onOpenChange={setAddOpen}
        householdId={householdId}
      />

      <DoneShoppingDialog
        open={doneOpen}
        onOpenChange={setDoneOpen}
        boughtItems={boughtItems}
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

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes (assuming `useDashboard` already exposes `household`, `currentUserId`, `isAdmin`; if not, Task 19 will fix that).

- [ ] **Step 3: Commit**

```bash
git add FrontEnd/src/pages/dashboard/ShoppingListPage.tsx
git commit -m "feat(frontend): add ShoppingListPage with primary done-shopping flow"
```

---

### Task 19: Verify DashboardContext exposes the values ShoppingListPage uses

**Files:**
- Modify (only if needed): `FrontEnd/src/contexts/DashboardContext.tsx`

- [ ] **Step 1: Inspect DashboardContext**

```bash
grep -n "household\|currentUserId\|isAdmin" FrontEnd/src/contexts/DashboardContext.tsx | head -30
```

If `household`, `currentUserId`, and `isAdmin` are already exposed on the context value, **skip to Task 20**. The TasksPage uses these patterns, so they almost certainly exist.

- [ ] **Step 2 (only if missing): Add the missing fields to the context**

If any of the three are missing, add them to the context's value type and provider implementation. Reuse the same patterns the existing tasks-related state uses. After adding, run type-check.

```bash
cd FrontEnd && npx tsc --noEmit
```

- [ ] **Step 3: Commit if anything changed**

```bash
git add FrontEnd/src/contexts/DashboardContext.tsx
git commit -m "chore(frontend): expose household/currentUserId/isAdmin on DashboardContext (if needed)"
```

(If nothing changed, skip the commit.)

---

### Task 20: Register the route in App.tsx

**Files:**
- Modify: `FrontEnd/src/App.tsx`

- [ ] **Step 1: Add the lazy import alongside the other dashboard pages**

Around line 24-29, add a new line:

```typescript
const ShoppingListPage = lazy(() => import('@/pages/dashboard/ShoppingListPage'));
```

Place it between `TasksPage` and `GoalsPage` so the import order matches the planned nav order.

- [ ] **Step 2: Add the `<Route>` inside the dashboard block**

Find:

```tsx
<Route index element={<Navigate to="overview" replace />} />
<Route path="overview" element={<OverviewPage />} />
<Route path="expenses" element={<ExpensesPage />} />
<Route path="tasks" element={<TasksPage />} />
<Route path="goals" element={<GoalsPage />} />
```

Insert the new route between tasks and goals:

```tsx
<Route path="shopping-list" element={<ShoppingListPage />} />
```

So the block becomes:

```tsx
<Route path="overview" element={<OverviewPage />} />
<Route path="expenses" element={<ExpensesPage />} />
<Route path="tasks" element={<TasksPage />} />
<Route path="shopping-list" element={<ShoppingListPage />} />
<Route path="goals" element={<GoalsPage />} />
```

- [ ] **Step 3: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 4: Quick browser check**

```bash
cd FrontEnd && npm run dev
```

Manually navigate to `http://localhost:5173/dashboard/shopping-list` (URL may differ if dev port differs) and confirm the page renders. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add FrontEnd/src/App.tsx
git commit -m "feat(frontend): register /dashboard/shopping-list route"
```

---

### Task 21: Add nav item in AppLayout (couple-only)

**Files:**
- Modify: `FrontEnd/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Inspect the existing useNavItems hook**

```bash
grep -n "useNavItems\|household.type\|'overview'\|'tasks'" FrontEnd/src/components/layout/AppLayout.tsx
```

Identify where `tasks` is conditionally pushed. The new shopping-list item should sit between `tasks` and `goals`.

- [ ] **Step 2: Read whatever the household type field is named on the dashboard context**

```bash
grep -rn "type.*=.*'couple'\|type.*===.*'couple'\|HouseholdType" FrontEnd/src/types/household.types.ts FrontEnd/src/contexts/DashboardContext.tsx | head
```

Confirm whether the value is `household.type === 'couple'` (likely) or something else.

- [ ] **Step 3: Import a suitable icon and add the conditional nav item**

In `useNavItems()`:
- Import `ShoppingCart` from `lucide-react` if not already imported.
- After the `tasks` push and before the `goals` push, add:

```typescript
if (household?.type === 'couple') {
  items.push({
    id: 'shopping-list',
    label: 'Shopping',
    href: '/dashboard/shopping-list',
    icon: ShoppingCart,
  });
}
```

(Use whichever variable the hook has access to for the household — `useDashboard()` already provides it elsewhere in the same hook.)

- [ ] **Step 4: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 5: Manual check in browser**

```bash
cd FrontEnd && npm run dev
```

- Log in as a member of a couple household → confirm the "Shopping" nav item appears in the sidebar.
- (If you have a roommate household account or test data) Log in as a member of a roommate household → confirm the item is **hidden**.
- Click the nav item → confirm it routes to `/dashboard/shopping-list`.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add FrontEnd/src/components/layout/AppLayout.tsx
git commit -m "feat(frontend): add Shopping nav item for couple households"
```

---

### Task 22: Tab-leave guard (sidebar interception + dirty state)

**Files:**
- Modify: `FrontEnd/src/contexts/DashboardContext.tsx`
- Modify: `FrontEnd/src/components/layout/AppLayout.tsx`
- Modify: `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`

- [ ] **Step 1: Add dirty-state tracking and a pending-nav slot to DashboardContext**

In `FrontEnd/src/contexts/DashboardContext.tsx`, extend the context value type with three new fields:

```typescript
shoppingListBoughtCount: number;
setShoppingListBoughtCount: (n: number) => void;
pendingNavigationPath: string | null;
setPendingNavigationPath: (path: string | null) => void;
```

In the provider, add the corresponding `useState`:

```typescript
const [shoppingListBoughtCount, setShoppingListBoughtCount] = useState(0);
const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
```

Include all four in the provider value object.

- [ ] **Step 2: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Wire the dirty-state from ShoppingListPage**

In `FrontEnd/src/pages/dashboard/ShoppingListPage.tsx`, add a `useEffect` that pushes `boughtItems.length` into the context whenever it changes, and resets it to `0` on unmount:

```tsx
import { useEffect } from 'react';

// inside the component, near other hooks:
const { setShoppingListBoughtCount } = useDashboard();
useEffect(() => {
  setShoppingListBoughtCount(boughtItems.length);
  return () => setShoppingListBoughtCount(0);
}, [boughtItems.length, setShoppingListBoughtCount]);
```

Also add an effect that runs the convert flow when the user picks "Convert now" from the leave-prompt. This needs a way to be triggered from outside the page — simplest: the leave guard sets `pendingNavigationPath` to the target route, and a separate flag `triggerConvertFromGuard` to start the flow.

For v1, keep this simpler: the page exports the `handleConvertConfirm` via context too. Add to the context value:

```typescript
shoppingListConvertHandler: (() => void) | null;
setShoppingListConvertHandler: (fn: (() => void) | null) => void;
```

In `ShoppingListPage`, register and de-register the handler:

```tsx
const { setShoppingListConvertHandler } = useDashboard();
useEffect(() => {
  setShoppingListConvertHandler(handleConvertConfirm);
  return () => setShoppingListConvertHandler(null);
}, [setShoppingListConvertHandler, handleConvertConfirm]);
```

(Make sure `handleConvertConfirm` is wrapped with `useCallback` so the effect doesn't re-fire on every render.)

- [ ] **Step 4: Modify AppLayout sidebar links to consult the guard**

In `FrontEnd/src/components/layout/AppLayout.tsx`, where the nav items are rendered as `<Link>` (or similar), wrap the `onClick`:

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
import LeaveShoppingPromptDialog from '@/components/dashboard/shared/LeaveShoppingPromptDialog';

// inside the layout component:
const navigate = useNavigate();
const location = useLocation();
const {
  shoppingListBoughtCount,
  setPendingNavigationPath,
  pendingNavigationPath,
  shoppingListConvertHandler,
} = useDashboard();
const [leavePromptOpen, setLeavePromptOpen] = useState(false);

function handleNavClick(e: React.MouseEvent, href: string) {
  // Only intercept when leaving the shopping-list page with bought items present
  if (
    location.pathname.startsWith('/dashboard/shopping-list') &&
    shoppingListBoughtCount > 0 &&
    !href.startsWith('/dashboard/shopping-list')
  ) {
    e.preventDefault();
    setPendingNavigationPath(href);
    setLeavePromptOpen(true);
  }
}
```

Apply this `onClick={(e) => handleNavClick(e, item.href)}` to each nav `<Link>` (or to the underlying `<a>` if not using `<Link>` components).

Render the prompt at the bottom of the layout:

```tsx
<LeaveShoppingPromptDialog
  open={leavePromptOpen}
  boughtCount={shoppingListBoughtCount}
  onConvertNow={() => {
    setLeavePromptOpen(false);
    if (shoppingListConvertHandler) shoppingListConvertHandler();
    // Note: pendingNavigationPath stays set; navigation happens after expense submit (out of scope for v1 — user manually navigates)
  }}
  onLeaveAnyway={() => {
    setLeavePromptOpen(false);
    if (pendingNavigationPath) {
      navigate(pendingNavigationPath);
      setPendingNavigationPath(null);
    }
  }}
/>
```

**Note for v1**: after "Convert now", the user lands in the expense form. Navigation to `pendingNavigationPath` after a successful save is a nice-to-have but not required for v1 — calling out `pendingNavigationPath` here lets a future iteration auto-navigate without re-architecting.

- [ ] **Step 5: Type-check**

```bash
cd FrontEnd && npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 6: Manual end-to-end check**

```bash
cd FrontEnd && npm run dev
```

In the browser:
1. Go to the shopping list, add 2 items, mark one as bought.
2. Click the "Expenses" nav link → leave-prompt dialog should appear.
3. Click "Leave anyway" → navigates to expenses; bought item still on shopping list.
4. Return to shopping list → click "Expenses" again → prompt appears again (v1 has no per-session suppression).
5. Click "Convert now" → expense form opens with prefilled values.
6. Submit the expense → bought items get cleared from list, expense visible in Expenses tab.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add FrontEnd/src/contexts/DashboardContext.tsx FrontEnd/src/components/layout/AppLayout.tsx FrontEnd/src/pages/dashboard/ShoppingListPage.tsx
git commit -m "feat(frontend): wire shopping-list leave-guard via sidebar interception"
```

---

## Phase F — Final verification

### Task 23: End-to-end manual verification + lint pass

- [ ] **Step 1: Type-check both packages**

```bash
cd BackEnd && npm run type-check && cd ../FrontEnd && npx tsc --noEmit
```

Expected: both pass with no errors.

- [ ] **Step 2: Lint frontend**

```bash
cd FrontEnd && npm run lint
```

Expected: no new warnings or errors. (Pre-existing lint issues from before this branch are acceptable; new ones are not.)

- [ ] **Step 3: Build frontend (catches deeper TS issues)**

```bash
cd FrontEnd && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Full end-to-end walkthrough with two test accounts**

Spin up backend + frontend in two terminals:

```bash
# Terminal 1
cd BackEnd && npm run dev
# Terminal 2
cd FrontEnd && npm run dev
```

In two separate browser profiles (or one private window + one regular), log in as the two members of a **couple** household.

Member A:
- Confirms "Shopping" nav item is visible.
- Adds 3 items: "milk" (qty 2L), "eggs" (no qty, no notes), "toilet paper" (notes "the soft kind").
- Verifies all 3 items appear with correct fields.

Member B:
- Refreshes the shopping tab → sees all 3 items added by Member A.
- Marks "milk" and "eggs" as bought (checkboxes).
- Sees "Done shopping (2)" button appear.
- Clicks it → confirmation dialog summarises both items.
- Clicks "Open expense form" → expense Sheet opens with:
  - description = `"2L milk, eggs"`
  - category = `"groceries"`
  - date = today
  - paid by = Member B
  - amount = empty
- Enters £35 → saves.
- Verifies expense appears in the Expenses tab.
- Verifies "milk" and "eggs" are gone from the shopping list; "toilet paper" remains.

Member A:
- Refreshes shopping tab → sees only "toilet paper".
- Marks it bought.
- Clicks the sidebar "Expenses" link → leave-guard prompt fires.
- Clicks "Leave anyway" → navigates to expenses; bought item still on shopping list.
- Returns to shopping → clicks "Expenses" again → prompt appears again.
- Clicks "Convert now" → expense form opens prefilled with "toilet paper".
- Cancels the expense form (no expense created).
- Verifies "toilet paper" is still on the list, still marked as bought.

Optional roommate check (if test data permits):
- Log in as a member of a **roommate** household → confirm "Shopping" nav item is **not visible**.

- [ ] **Step 5: Stop dev servers**

- [ ] **Step 6: Final commit if anything was tweaked during the walkthrough**

```bash
git status
# If clean: skip the commit step.
# If you fixed any issues, stage and commit them as small fixups:
git add -p
git commit -m "fix(shopping-list): <describe what you fixed>"
```

- [ ] **Step 7: Verify the branch history is clean and ready for PR**

```bash
git log --oneline main..HEAD
```

Expected: a clean ordered list of commits matching the tasks above. No "WIP" or "fixup" leftovers.

---

## Spec coverage map

| Spec section | Implemented in |
|---|---|
| Backend model | Task 2 |
| Backend service (5 methods) | Task 4 |
| Backend routes (5 endpoints) | Tasks 5, 6, 7 |
| Backend authorization (member-only) | Task 4 (via `getHouseholdForMember`) |
| Frontend types | Task 9 |
| Frontend API client | Task 10 |
| Frontend query hooks | Task 11 |
| AddShoppingItemForm | Task 13 |
| ShoppingListView | Task 14 |
| DoneShoppingDialog | Task 15 |
| LeaveShoppingPromptDialog | Task 16 |
| AddExpenseForm `initialValues` | Task 17 |
| ShoppingListPage | Task 18 |
| Routing — `/dashboard/shopping-list` | Task 20 |
| AppLayout nav item (couple-only) | Task 21 |
| DashboardContext state hoisting | Tasks 19, 22 |
| Flow A — explicit "Done shopping" button | Task 18 |
| Flow B — tab-leave safety net (sidebar interception) | Task 22 |
| Verification plan | Task 23 |

All YAGNI items from the spec ("Out of Scope for v1") are correctly absent from the plan: no item categories, no frequent items, no multi-payer split, no archive view, no recurring items, no inline editing, no hard nav guards (back/close/refresh), no once-per-session dismissal.
