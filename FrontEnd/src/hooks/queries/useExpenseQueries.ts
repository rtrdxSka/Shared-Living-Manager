import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { expenseApi } from '@/api/expense.api';
import type { AddExpenseInput, UpdateExpenseInput } from '@/types/expense.types';

export function useExpenses(householdId: string, month: string) {
  return useQuery({
    queryKey: queryKeys.expenses.list(householdId, month),
    queryFn: () => expenseApi.listExpenses(householdId, month),
    staleTime: 5 * 60 * 1000,
    // Align with the rest of the app: holding 6 months of expense lists in
    // memory for 30 min was wasteful; 10 min is plenty of back-nav buffer.
    gcTime: 10 * 60 * 1000,
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
        refetchType: 'active',
      });
      // Expenses affect joint account balance
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jointAccount.all(householdId),
        refetchType: 'active',
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
        refetchType: 'active',
      });
      // Expenses affect joint account balance
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jointAccount.all(householdId),
        refetchType: 'active',
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
        refetchType: 'active',
      });
      // Expenses affect joint account balance
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jointAccount.all(householdId),
        refetchType: 'active',
      });
    },
  });
}

// Cancel in-flight expense list queries so a rapid second click doesn't race
// the first mutation's refetch. Full optimistic state-flip on these hooks
// would need `currentUserId` / resolution-state context that's not available
// in the hook API; cancelQueries handles the double-submit race on its own.
async function cancelExpenseListQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string
) {
  await queryClient.cancelQueries({ queryKey: queryKeys.expenses.all(householdId) });
}

export function useClaimExpense(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) =>
      expenseApi.claimExpense(householdId, expenseId),
    onMutate: () => cancelExpenseListQueries(queryClient, householdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
        refetchType: 'active',
      });
    },
  });
}

export function useRequestResolution(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => expenseApi.requestResolution(householdId, expenseId),
    onMutate: () => cancelExpenseListQueries(queryClient, householdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
        refetchType: 'active',
      });
    },
  });
}

export function useConfirmResolution(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => expenseApi.confirmResolution(householdId, expenseId),
    onMutate: () => cancelExpenseListQueries(queryClient, householdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
        refetchType: 'active',
      });
    },
  });
}

export function useDisputeResolution(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => expenseApi.disputeResolution(householdId, expenseId),
    onMutate: () => cancelExpenseListQueries(queryClient, householdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(householdId),
        refetchType: 'active',
      });
    },
  });
}
