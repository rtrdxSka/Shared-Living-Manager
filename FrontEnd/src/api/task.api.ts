import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type { TaskResponse, AddTaskInput, RotationStatus } from '@/types/task.types';

export const taskApi = {
  async listTasks(
    householdId: string
  ): Promise<{ tasks: TaskResponse[]; rotation?: RotationStatus }> {
    const { data } = await api.get<
      ApiSuccessResponse<{ tasks: TaskResponse[]; rotation?: RotationStatus }>
    >(`/households/${householdId}/tasks`);
    return data.data;
  },

  async addTask(householdId: string, input: AddTaskInput): Promise<TaskResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ task: TaskResponse }>>(
      `/households/${householdId}/tasks`,
      input
    );
    return data.data.task;
  },

  async toggleComplete(householdId: string, taskId: string): Promise<TaskResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ task: TaskResponse }>>(
      `/households/${householdId}/tasks/${taskId}/complete`
    );
    return data.data.task;
  },

  async deleteTask(householdId: string, taskId: string): Promise<void> {
    await api.delete(`/households/${householdId}/tasks/${taskId}`);
  },

  async setRotation(householdId: string, startMemberId: string): Promise<RotationStatus> {
    const { data } = await api.patch<ApiSuccessResponse<{ rotation: RotationStatus }>>(
      `/households/${householdId}/tasks/rotation`,
      { startMemberId }
    );
    return data.data.rotation;
  },
};
