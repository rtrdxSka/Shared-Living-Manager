import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { recurringTaskApi } from '@/api/recurring-task.api';
import type { CreateRecurringTaskInput } from '@/types/recurring-task.types';

export function useRecurringTasks(householdId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.recurringTasks.list(householdId),
    queryFn: () => recurringTaskApi.list(householdId),
    enabled,
    // Recurring templates change infrequently; mutations invalidate the
    // cache immediately, so a longer stale window is safe.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useCreateRecurringTask(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecurringTaskInput) =>
      recurringTaskApi.create(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recurringTasks.all(householdId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.all(householdId),
      });
    },
  });
}

export function useDeactivateRecurringTask(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      recurringTaskApi.deactivate(householdId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recurringTasks.all(householdId),
      });
    },
  });
}
