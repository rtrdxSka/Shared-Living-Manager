import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shoppingListApi, type ShoppingListResult } from '@/api/shoppingList.api';
import type { ShoppingListItemResponse, AddShoppingItemInput } from '@/types/shoppingList.types';
import { queryKeys } from '@/lib/queryKeys';

export function useShoppingList(householdId: string) {
  return useQuery({
    queryKey: queryKeys.shoppingList.list(householdId),
    queryFn: () => shoppingListApi.listItems(householdId),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function useAddShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShoppingListItemResponse, Error, AddShoppingItemInput>({
    mutationFn: (input) => shoppingListApi.addItem(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useToggleShoppingItemBought(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string, { previous: ShoppingListResult | undefined }>({
    mutationFn: (itemId: string) => shoppingListApi.toggleBought(householdId, itemId),
    onMutate: async (itemId) => {
      const listKey = queryKeys.shoppingList.list(householdId);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<ShoppingListResult>(listKey);
      queryClient.setQueryData<ShoppingListResult>(listKey, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((i) =>
                i._id === itemId ? { ...i, isBought: !i.isBought } : i
              ),
            }
          : old
      );
      return { previous };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.shoppingList.list(householdId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.shoppingList.all(householdId),
        refetchType: 'active',
      });
    },
  });
}

export function useDeleteShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (itemId: string) => shoppingListApi.deleteItem(householdId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useClearBoughtShoppingItems(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ deletedCount: number }, Error, void>({
    mutationFn: () => shoppingListApi.clearBought(householdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}
