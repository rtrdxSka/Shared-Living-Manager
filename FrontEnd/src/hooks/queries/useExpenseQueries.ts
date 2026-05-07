import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { expenseApi, type ExpenseListResult } from '@/api/expense.api';
import type {
  AddExpenseInput,
  ExpenseFilters,
  UpdateExpenseInput,
} from '@/types/expense.types';

const PAGE_SIZE = 20;

export function useExpenses(householdId: string, month: string, filters?: ExpenseFilters) {
  const apiFilters = filters
    ? {
        search: filters.search.trim() || undefined,
        categories: filters.categories.length > 0 ? filters.categories : undefined,
        paidBy: filters.paidBy.length > 0 ? filters.paidBy : undefined,
        status: filters.status ?? undefined,
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.expenses.list(householdId, month, {
      search: apiFilters?.search,
      categories: apiFilters?.categories,
      paidBy: apiFilters?.paidBy,
      status: apiFilters?.status ?? null,
    }),
    queryFn: ({ pageParam }) =>
      expenseApi.listExpenses(householdId, {
        month,
        ...apiFilters,
        cursor: pageParam as string | undefined,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ExpenseListResult) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(householdId),
    staleTime: 5 * 60 * 1000,
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jointAccount.all(householdId),
        refetchType: 'active',
      });
    },
  });
}

// Cancel in-flight expense list queries so a rapid second click doesn't race
// the first mutation's refetch.
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
