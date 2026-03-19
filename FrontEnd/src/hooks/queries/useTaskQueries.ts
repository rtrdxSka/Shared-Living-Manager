import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { taskApi } from '@/api/task.api';
import type { AddTaskInput, AssignTaskInput } from '@/types/task.types';

export function useTasks(householdId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.list(householdId),
    queryFn: () => taskApi.listTasks(householdId),
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useAddTask(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddTaskInput) =>
      taskApi.addTask(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.all(householdId),
      });
    },
  });
}

export function useToggleTaskComplete(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      taskApi.toggleComplete(householdId, taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.all(householdId),
      });
    },
  });
}

export function useDeleteTask(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      taskApi.deleteTask(householdId, taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.all(householdId),
      });
    },
  });
}

export function useAssignTask(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: AssignTaskInput;
    }) => taskApi.assignTask(householdId, taskId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.all(householdId),
      });
    },
  });
}

export function useSetRotation(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (startMemberId: string) =>
      taskApi.setRotation(householdId, startMemberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.all(householdId),
      });
    },
  });
}
