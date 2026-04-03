import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type { ExpenseResponse, AddExpenseInput, UpdateExpenseInput } from '@/types/expense.types';
import type { PaginationMeta } from '@/types/pagination.types';

export interface ExpenseListResult extends PaginationMeta {
  expenses: ExpenseResponse[];
}

export const expenseApi = {
  async addExpense(householdId: string, input: AddExpenseInput): Promise<ExpenseResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ expense: ExpenseResponse }>>(
      `/households/${householdId}/expenses`,
      input
    );
    return data.data.expense;
  },

  async deleteExpense(householdId: string, expenseId: string): Promise<void> {
    await api.delete(`/households/${householdId}/expenses/${expenseId}`);
  },

  async updateExpense(
    householdId: string,
    expenseId: string,
    input: UpdateExpenseInput
  ): Promise<ExpenseResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ expense: ExpenseResponse }>>(
      `/households/${householdId}/expenses/${expenseId}`,
      input
    );
    return data.data.expense;
  },

  async claimExpense(householdId: string, expenseId: string): Promise<ExpenseResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ expense: ExpenseResponse }>>(
      `/households/${householdId}/expenses/${expenseId}/claim`
    );
    return data.data.expense;
  },

  async resolveExpense(householdId: string, expenseId: string): Promise<ExpenseResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ expense: ExpenseResponse }>>(
      `/households/${householdId}/expenses/${expenseId}/resolve`
    );
    return data.data.expense;
  },

  async listExpenses(
    householdId: string,
    month?: string,
    category?: string
  ): Promise<ExpenseListResult> {
    const params: Record<string, string> = {};
    if (month) params.month = month;
    if (category && category !== 'all') params.category = category;
    const { data } = await api.get<ApiSuccessResponse<ExpenseListResult>>(
      `/households/${householdId}/expenses`,
      { params }
    );
    return data.data;
  },
};
