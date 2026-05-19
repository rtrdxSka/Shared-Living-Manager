import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { budgetApi } from '@/api/budget.api';
import type { BudgetUpdateRequest } from '@/types/budget.types';

export function useBudget(householdId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.budget.current(householdId),
    queryFn: () => budgetApi.getBudget(householdId),
    enabled: enabled && Boolean(householdId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useBudgetInsights(householdId: string, month: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.budget.insights(householdId, month),
    queryFn: () => budgetApi.getInsights(householdId, month),
    enabled: enabled && Boolean(householdId) && Boolean(month),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useUpdateBudget(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BudgetUpdateRequest) =>
      budgetApi.updateBudget(householdId, input),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budget.all(householdId),
      });
    },

    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budget.all(householdId),
      });
    },
  });
}
