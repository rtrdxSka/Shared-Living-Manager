import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { taskApi } from '@/api/task.api';
import type { TaskListResult } from '@/api/task.api';
import type { AddTaskInput, AssignTaskInput } from '@/types/task.types';

const PAGE_SIZE = 20;

export function useTasks(householdId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.tasks.list(householdId),
    queryFn: ({ pageParam }) =>
      taskApi.listTasks(householdId, {
        cursor: pageParam as string | undefined,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TaskListResult) => lastPage.nextCursor ?? undefined,
    enabled: enabled && Boolean(householdId),
    staleTime: 5 * 60 * 1000,
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

  return useMutation<
    unknown,
    Error,
    string,
    { previous: InfiniteData<TaskListResult> | undefined }
  >({
    mutationFn: (taskId: string) =>
      taskApi.toggleComplete(householdId, taskId),

    // Optimistic toggle — gives instant feedback on click and prevents the
    // double-request race when the user taps the checkbox twice.
    onMutate: async (taskId) => {
      const listKey = queryKeys.tasks.list(householdId);
      await queryClient.cancelQueries({ queryKey: listKey });

      const previous = queryClient.getQueryData<InfiniteData<TaskListResult>>(listKey);

      queryClient.setQueryData<InfiniteData<TaskListResult>>(listKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((t) =>
              t._id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
            ),
          })),
        };
      });

      return { previous };
    },

    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.tasks.list(householdId),
          context.previous
        );
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.all(householdId),
        refetchType: 'active',
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
    // Refetch on conflict so a stale "Claim this task" row reconciles to the
    // true assignee (e.g. another member won the atomic claim race).
    onError: () => {
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
