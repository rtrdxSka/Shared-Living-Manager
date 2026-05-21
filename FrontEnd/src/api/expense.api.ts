import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  ExpenseResponse,
  AddExpenseInput,
  UpdateExpenseInput,
  ExpenseStatusFilter,
} from '@/types/expense.types';
import type { ExpenseType } from '@/types/onboarding.types';

export interface ExpenseListResult {
  items: ExpenseResponse[];
  nextCursor: string | null;
}

export interface ListExpensesParams {
  month?: string;
  search?: string;
  categories?: ExpenseType[];
  paidBy?: string[];
  status?: ExpenseStatusFilter;
  cursor?: string;
  limit?: number;
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

  async claimPayback(householdId: string, expenseId: string): Promise<ExpenseResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ expense: ExpenseResponse }>>(
      `/households/${householdId}/expenses/${expenseId}/claim-payback`
    );
    return data.data.expense;
  },

  async confirmPayback(
    householdId: string,
    expenseId: string,
    debtorUserId: string
  ): Promise<ExpenseResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ expense: ExpenseResponse }>>(
      `/households/${householdId}/expenses/${expenseId}/confirm-payback`,
      { debtorUserId }
    );
    return data.data.expense;
  },

  async disputePayback(
    householdId: string,
    expenseId: string,
    debtorUserId: string
  ): Promise<ExpenseResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ expense: ExpenseResponse }>>(
      `/households/${householdId}/expenses/${expenseId}/dispute-payback`,
      { debtorUserId }
    );
    return data.data.expense;
  },

  async listExpenses(
    householdId: string,
    params: ListExpensesParams = {}
  ): Promise<ExpenseListResult> {
    const { data } = await api.get<ApiSuccessResponse<ExpenseListResult>>(
      `/households/${householdId}/expenses`,
      {
        params,
        paramsSerializer: { indexes: null },
      }
    );
    return data.data;
  },
};
