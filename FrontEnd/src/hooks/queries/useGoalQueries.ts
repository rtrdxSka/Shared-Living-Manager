import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { goalApi } from '@/api/goal.api';
import type {
  AddGoalInput,
  UpdateGoalInput,
  AddContributionInput,
} from '@/types/goal.types';

export function useGoals(householdId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.goals.list(householdId),
    queryFn: () => goalApi.listGoals(householdId),
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useAddGoal(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddGoalInput) =>
      goalApi.addGoal(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(householdId),
      });
    },
  });
}

export function useUpdateGoal(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      input,
    }: {
      goalId: string;
      input: UpdateGoalInput;
    }) => goalApi.updateGoal(householdId, goalId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(householdId),
      });
    },
  });
}

export function useDeleteGoal(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) =>
      goalApi.deleteGoal(householdId, goalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(householdId),
      });
    },
  });
}

export function useAddContribution(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      input,
    }: {
      goalId: string;
      input: AddContributionInput;
    }) => goalApi.addContribution(householdId, goalId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(householdId),
      });
    },
  });
}

export function useRemoveContribution(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      contributionId,
    }: {
      goalId: string;
      contributionId: string;
    }) => goalApi.removeContribution(householdId, goalId, contributionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(householdId),
      });
    },
  });
}
