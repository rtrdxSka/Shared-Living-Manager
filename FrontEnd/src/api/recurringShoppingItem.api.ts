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
