import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  recurringShoppingItemApi,
  type RecurringShoppingItemListResult,
} from '@/api/recurringShoppingItem.api';
import type {
  RecurringShoppingItemResponse,
  CreateRecurringShoppingItemInput,
  UpdateRecurringShoppingItemInput,
} from '@/types/recurringShoppingItem.types';
import { queryKeys } from '@/lib/queryKeys';

export function useRecurringRules(householdId: string) {
  return useQuery<RecurringShoppingItemListResult>({
    queryKey: queryKeys.shoppingList.recurring(householdId),
    queryFn: () => recurringShoppingItemApi.listRules(householdId),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function useCreateRecurringRule(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<RecurringShoppingItemResponse, Error, CreateRecurringShoppingItemInput>({
    mutationFn: (input) => recurringShoppingItemApi.createRule(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.recurring(householdId) });
    },
  });
}

export function useUpdateRecurringRule(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    RecurringShoppingItemResponse,
    Error,
    { ruleId: string; input: UpdateRecurringShoppingItemInput }
  >({
    mutationFn: ({ ruleId, input }) => recurringShoppingItemApi.updateRule(householdId, ruleId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.recurring(householdId) });
    },
  });
}

export function useDeleteRecurringRule(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (ruleId) => recurringShoppingItemApi.deleteRule(householdId, ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.recurring(householdId) });
    },
  });
}
