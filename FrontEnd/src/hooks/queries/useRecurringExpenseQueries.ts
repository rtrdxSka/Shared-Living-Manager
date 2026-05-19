import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { recurringExpenseApi } from '@/api/recurring-expense.api';
import type { CreateRecurringExpenseInput } from '@/types/recurring-expense.types';

export function useRecurringExpenses(householdId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.recurringExpenses.list(householdId),
    queryFn: () => recurringExpenseApi.list(householdId),
    enabled,
    // Recurring templates change infrequently; mutations invalidate the
    // cache immediately, so a longer stale window is safe.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useCreateRecurringExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecurringExpenseInput) =>
      recurringExpenseApi.create(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recurringExpenses.all(householdId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budget.all(householdId),
      });
    },
  });
}

export function useDeactivateRecurringExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      recurringExpenseApi.deactivate(householdId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recurringExpenses.all(householdId),
      });
    },
  });
}
