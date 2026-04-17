import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  RecurringExpenseResponse,
  CreateRecurringExpenseInput,
  UpdateRecurringExpenseInput,
} from '@/types/recurring-expense.types';

export const recurringExpenseApi = {
  async create(
    householdId: string,
    input: CreateRecurringExpenseInput
  ): Promise<RecurringExpenseResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ recurringExpense: RecurringExpenseResponse }>>(
      `/households/${householdId}/recurring-expenses`,
      input
    );
    return data.data.recurringExpense;
  },

  async list(householdId: string): Promise<RecurringExpenseResponse[]> {
    const { data } = await api.get<ApiSuccessResponse<{ recurringExpenses: RecurringExpenseResponse[] }>>(
      `/households/${householdId}/recurring-expenses`
    );
    return data.data.recurringExpenses;
  },

  async update(
    householdId: string,
    id: string,
    input: UpdateRecurringExpenseInput
  ): Promise<RecurringExpenseResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ recurringExpense: RecurringExpenseResponse }>>(
      `/households/${householdId}/recurring-expenses/${id}`,
      input
    );
    return data.data.recurringExpense;
  },

  async deactivate(householdId: string, id: string): Promise<void> {
    await api.delete(`/households/${householdId}/recurring-expenses/${id}`);
  },
};
