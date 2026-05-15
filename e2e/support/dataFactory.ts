import { request as playwrightRequest } from '@playwright/test';

import { TestApi } from './testApi';

const API_BASE = 'http://localhost:5001/api';

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
    const res = await api.post(`/households/${opts.householdId}/expenses`, {
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
    const res = await api.post(`/households/${opts.householdId}/tasks`, {
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
