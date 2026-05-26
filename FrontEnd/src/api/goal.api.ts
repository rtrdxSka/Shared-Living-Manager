import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  GoalResponse,
  AddGoalInput,
  UpdateGoalInput,
  AddContributionInput,
  GoalStatus,
  GoalPriority,
} from '@/types/goal.types';
import type { PaginationMeta } from '@/types/pagination.types';

export interface GoalListResult extends PaginationMeta {
  items: GoalResponse[];
}

export const goalApi = {
  async listGoals(
    householdId: string,
    status?: GoalStatus
  ): Promise<GoalListResult> {
    const params = status ? { status } : undefined;
    const { data } = await api.get<ApiSuccessResponse<GoalListResult>>(
      `/households/${householdId}/goals`,
      { params }
    );
    return data.data;
  },

  async getGoal(householdId: string, goalId: string): Promise<GoalResponse> {
    const { data } = await api.get<ApiSuccessResponse<{ goal: GoalResponse }>>(
      `/households/${householdId}/goals/${goalId}`
    );
    return data.data.goal;
  },

  async addGoal(householdId: string, input: AddGoalInput): Promise<GoalResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ goal: GoalResponse }>>(
      `/households/${householdId}/goals`,
      input
    );
    return data.data.goal;
  },

  async updateGoal(
    householdId: string,
    goalId: string,
    input: UpdateGoalInput
  ): Promise<GoalResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ goal: GoalResponse }>>(
      `/households/${householdId}/goals/${goalId}`,
      input
    );
    return data.data.goal;
  },

  async setGoalPriority(
    householdId: string,
    goalId: string,
    priority: GoalPriority
  ): Promise<GoalResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ goal: GoalResponse }>>(
      `/households/${householdId}/goals/${goalId}/priority`,
      { priority }
    );
    return data.data.goal;
  },

  async deleteGoal(householdId: string, goalId: string): Promise<void> {
    await api.delete(`/households/${householdId}/goals/${goalId}`);
  },

  async addContribution(
    householdId: string,
    goalId: string,
    input: AddContributionInput
  ): Promise<GoalResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ goal: GoalResponse }>>(
      `/households/${householdId}/goals/${goalId}/contributions`,
      input
    );
    return data.data.goal;
  },

  async removeContribution(
    householdId: string,
    goalId: string,
    contributionId: string
  ): Promise<GoalResponse> {
    const { data } = await api.delete<ApiSuccessResponse<{ goal: GoalResponse }>>(
      `/households/${householdId}/goals/${goalId}/contributions/${contributionId}`
    );
    return data.data.goal;
  },
};
