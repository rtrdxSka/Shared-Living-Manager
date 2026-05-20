import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  RecurringTaskResponse,
  CreateRecurringTaskInput,
  UpdateRecurringTaskInput,
} from '@/types/recurring-task.types';

export const recurringTaskApi = {
  async create(
    householdId: string,
    input: CreateRecurringTaskInput
  ): Promise<RecurringTaskResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ recurringTask: RecurringTaskResponse }>>(
      `/households/${householdId}/recurring-tasks`,
      input
    );
    return data.data.recurringTask;
  },

  async list(householdId: string): Promise<RecurringTaskResponse[]> {
    const { data } = await api.get<ApiSuccessResponse<{ items: RecurringTaskResponse[] }>>(
      `/households/${householdId}/recurring-tasks`
    );
    return data.data.items;
  },

  async update(
    householdId: string,
    id: string,
    input: UpdateRecurringTaskInput
  ): Promise<RecurringTaskResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ recurringTask: RecurringTaskResponse }>>(
      `/households/${householdId}/recurring-tasks/${id}`,
      input
    );
    return data.data.recurringTask;
  },

  async deactivate(householdId: string, id: string): Promise<void> {
    await api.delete(`/households/${householdId}/recurring-tasks/${id}`);
  },
};
