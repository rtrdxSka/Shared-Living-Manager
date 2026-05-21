import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  Budget,
  BudgetInsights,
  BudgetInsightsScope,
  BudgetSnapshotResult,
  BudgetUpdateRequest,
} from '@/types/budget.types';

export const budgetApi = {
  async getBudget(householdId: string): Promise<Budget> {
    const { data } = await api.get<ApiSuccessResponse<{ budget: Budget }>>(
      `/households/${householdId}/budget`
    );
    return data.data.budget;
  },

  async updateBudget(householdId: string, input: BudgetUpdateRequest): Promise<Budget> {
    const { data } = await api.put<ApiSuccessResponse<{ budget: Budget }>>(
      `/households/${householdId}/budget`,
      input
    );
    return data.data.budget;
  },

  async getSnapshot(householdId: string, month: string): Promise<BudgetSnapshotResult> {
    const { data } = await api.get<ApiSuccessResponse<BudgetSnapshotResult>>(
      `/households/${householdId}/budget/snapshot`,
      { params: { month } }
    );
    return data.data;
  },

  async getInsights(
    householdId: string,
    month: string,
    scope?: BudgetInsightsScope
  ): Promise<BudgetInsights> {
    const { data } = await api.get<ApiSuccessResponse<BudgetInsights>>(
      `/households/${householdId}/budget/insights`,
      { params: scope ? { month, scope } : { month } }
    );
    return data.data;
  },
};
