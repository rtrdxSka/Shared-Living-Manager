import { request as playwrightRequest } from '@playwright/test';

import { TestApi } from './testApi';

// Origin-only base. Playwright's `request.newContext({ baseURL })` strips the
// path segment of `baseURL` whenever the request URL starts with `/`, so we
// prefix `/api/` per request (matches the pattern in `auth.ts` / `household.ts`).
const API_BASE = 'http://localhost:5001';

type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'internet'
  | 'groceries'
  | 'cleaning'
  | 'subscriptions'
  | 'other';

/**
 * Seeds an expense via the household-scoped expense endpoint. Body shape is
 * pulled from `addExpenseValidation` (BackEnd/src/validators/expense.validator.ts):
 *   { description, amount, category, date, notes?, paidByUserId?, isFullRepayment? }
 *
 * `date` is required by the validator (must be ISO 8601, not >1y in the
 * future). We default to "now" so callers don't have to think about it.
 *
 * Response (per expense.controller.ts):
 *   { status: 'success', data: { expense: { _id, ... } } }
 */
export async function seedExpense(opts: {
  token: string;
  householdId: string;
  amount: number;
  description: string;
  category?: ExpenseCategory;
  date?: string;
  notes?: string;
  paidByUserId?: string;
  isFullRepayment?: boolean;
}): Promise<{ _id: string }> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${opts.token}` },
  });
  try {
    const res = await api.post(`/api/households/${opts.householdId}/expenses`, {
      data: {
        description: opts.description,
        amount: opts.amount,
        category: opts.category ?? 'groceries',
        date: opts.date ?? new Date().toISOString(),
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
        ...(opts.paidByUserId !== undefined ? { paidByUserId: opts.paidByUserId } : {}),
        ...(opts.isFullRepayment !== undefined
          ? { isFullRepayment: opts.isFullRepayment }
          : {}),
      },
    });
    if (!res.ok()) {
      throw new Error(`seedExpense failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { expense?: { _id?: string } };
      expense?: { _id?: string };
    };
    const expense = body.data?.expense ?? body.expense;
    if (!expense?._id) {
      throw new Error(`seedExpense response missing _id: ${JSON.stringify(body)}`);
    }
    return { _id: expense._id };
  } finally {
    await api.dispose();
  }
}

/**
 * Seeds a task via the household-scoped task endpoint. Body shape per
 * `addTaskValidation`: { title, notes?, dueDate?, assignedToMemberId? }.
 *
 * Note: `assignedToMemberId` is the member-subdocument `_id`, NOT the user
 * id — see task service / household model.
 *
 * Response (per task.controller.ts):
 *   { status: 'success', data: { task: { _id, ... } } }
 */
export async function seedTask(opts: {
  token: string;
  householdId: string;
  title: string;
  notes?: string;
  dueDate?: string;
  assignedToMemberId?: string;
}): Promise<{ _id: string }> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${opts.token}` },
  });
  try {
    const res = await api.post(`/api/households/${opts.householdId}/tasks`, {
      data: {
        title: opts.title,
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
        ...(opts.dueDate !== undefined ? { dueDate: opts.dueDate } : {}),
        ...(opts.assignedToMemberId !== undefined
          ? { assignedToMemberId: opts.assignedToMemberId }
          : {}),
      },
    });
    if (!res.ok()) {
      throw new Error(`seedTask failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { task?: { _id?: string } };
      task?: { _id?: string };
    };
    const task = body.data?.task ?? body.task;
    if (!task?._id) {
      throw new Error(`seedTask response missing _id: ${JSON.stringify(body)}`);
    }
    return { _id: task._id };
  } finally {
    await api.dispose();
  }
}

/**
 * Thin wrapper over `TestApi.fastForwardRotation` for callers that already
 * have a household id but don't need a long-lived `TestApi` instance.
 */
export async function fastForwardRotation(
  householdId: string,
  daysBack: number,
): Promise<void> {
  const testApi = await TestApi.create();
  try {
    await testApi.fastForwardRotation(householdId, daysBack);
  } finally {
    await testApi.dispose();
  }
}

type ShoppingCategory =
  | 'rent'
  | 'utilities'
  | 'internet'
  | 'groceries'
  | 'cleaning'
  | 'subscriptions'
  | 'other';

/**
 * Seeds a shopping-list item via `POST /api/households/:id/shopping-list`.
 * Body shape per `addShoppingItemValidation`: `{ name, quantity?, notes?,
 * category }` — `category` is required by the validator.
 *
 * Response (per shopping-list.controller.ts `addItem`):
 *   { status: 'success', data: { item: { _id, ... } } }
 */
export async function seedShoppingItem(opts: {
  token: string;
  householdId: string;
  name: string;
  quantity?: string;
  notes?: string;
  category?: ShoppingCategory;
}): Promise<{ _id: string }> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${opts.token}` },
  });
  try {
    const res = await api.post(`/api/households/${opts.householdId}/shopping-list`, {
      data: {
        name: opts.name,
        category: opts.category ?? 'groceries',
        ...(opts.quantity !== undefined ? { quantity: opts.quantity } : {}),
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      },
    });
    if (!res.ok()) {
      throw new Error(`seedShoppingItem failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { item?: { _id?: string } };
    };
    const item = body.data?.item;
    if (!item?._id) {
      throw new Error(`seedShoppingItem response missing _id: ${JSON.stringify(body)}`);
    }
    return { _id: item._id };
  } finally {
    await api.dispose();
  }
}

type GoalCategory = 'savings' | 'travel' | 'home' | 'emergency' | 'other';

/**
 * Seeds a goal via `POST /api/households/:id/goals`. Body shape per
 * `addGoalValidation`: `{ name, description?, targetAmount, deadline?,
 * category? }`. `targetAmount` is validated as `isFloat({ min: 0.01 })`.
 *
 * Response (per goal.controller.ts `addGoal`):
 *   { status: 'success', data: { goal: { _id, ... } } }
 */
export async function seedGoal(opts: {
  token: string;
  householdId: string;
  name: string;
  targetAmount: number;
  description?: string;
  deadline?: string;
  category?: GoalCategory;
}): Promise<{ _id: string }> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${opts.token}` },
  });
  try {
    const res = await api.post(`/api/households/${opts.householdId}/goals`, {
      data: {
        name: opts.name,
        targetAmount: opts.targetAmount,
        ...(opts.description !== undefined ? { description: opts.description } : {}),
        ...(opts.deadline !== undefined ? { deadline: opts.deadline } : {}),
        ...(opts.category !== undefined ? { category: opts.category } : {}),
      },
    });
    if (!res.ok()) {
      throw new Error(`seedGoal failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { goal?: { _id?: string } };
    };
    const goal = body.data?.goal;
    if (!goal?._id) {
      throw new Error(`seedGoal response missing _id: ${JSON.stringify(body)}`);
    }
    return { _id: goal._id };
  } finally {
    await api.dispose();
  }
}

/**
 * Seeds a contribution onto an existing goal via
 * `POST /api/households/:id/goals/:goalId/contributions`. Body shape per
 * `addContributionValidation`: `{ amount, note? }`. `amount` is validated as
 * `isFloat({ min: 0.01 })`.
 *
 * Note: the backend AUTO-COMPLETES the goal when cumulative contributions
 * reach `targetAmount` (goal.service.ts addContribution branch
 * `if (currentAmount >= goal.targetAmount) goal.status = 'completed'`). This
 * is the surprise pinned by E05 — seeding a 100%-contribution goal then
 * trying to "mark complete" via the UI will not find the button because
 * the goal is already completed.
 *
 * Response (per goal.controller.ts `addContribution`):
 *   { status: 'success', data: { goal: { _id, ..., status, contributions } } }
 */
export async function seedGoalContribution(opts: {
  token: string;
  householdId: string;
  goalId: string;
  amount: number;
  note?: string;
}): Promise<{ status: string }> {
  const api = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${opts.token}` },
  });
  try {
    const res = await api.post(
      `/api/households/${opts.householdId}/goals/${opts.goalId}/contributions`,
      {
        data: {
          amount: opts.amount,
          ...(opts.note !== undefined ? { note: opts.note } : {}),
        },
      },
    );
    if (!res.ok()) {
      throw new Error(`seedGoalContribution failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data?: { goal?: { status?: string } };
    };
    const status = body.data?.goal?.status;
    if (!status) {
      throw new Error(`seedGoalContribution response missing status: ${JSON.stringify(body)}`);
    }
    return { status };
  } finally {
    await api.dispose();
  }
}
