import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { expenseApi } from '@/api/expense.api';
import type { AddExpenseInput, UpdateExpenseInput } from '@/types/expense.types';

export function useExpenses(householdId: string, month: string) {
  return useQuery({
    queryKey: queryKeys.expenses.list(householdId, month),
    queryFn: () => expenseApi.listExpenses(householdId, month),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAddExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddExpenseInput) =>
      expenseApi.addExpense(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
      });
    },
  });
}

export function useUpdateExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      input,
    }: {
      expenseId: string;
      input: UpdateExpenseInput;
    }) => expenseApi.updateExpense(householdId, expenseId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
      });
    },
  });
}

export function useDeleteExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) =>
      expenseApi.deleteExpense(householdId, expenseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
      });
    },
  });
}

export function useClaimExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) =>
      expenseApi.claimExpense(householdId, expenseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
      });
    },
  });
}

export function useResolveExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) =>
      expenseApi.resolveExpense(householdId, expenseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
      });
    },
  });
}
