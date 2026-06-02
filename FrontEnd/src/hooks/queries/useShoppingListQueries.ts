import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { shoppingListApi, type ShoppingListResult } from '@/api/shoppingList.api';
import type {
  ShoppingListItemResponse,
  AddShoppingItemInput,
  UpdateShoppingItemInput,
  HistoryPage,
  ShoppingListFilter,
} from '@/types/shoppingList.types';
import type { ExpenseType } from '@/types/onboarding.types';
import { queryKeys } from '@/lib/queryKeys';

const ACTIVE_PAGE_SIZE = 20;

export function useShoppingList(householdId: string, filter?: ShoppingListFilter) {
  const params = filter
    ? {
        search: filter.search.trim() || undefined,
        categories: filter.categories.length > 0 ? filter.categories : undefined,
        boughtState: filter.boughtState !== 'all' ? filter.boughtState : undefined,
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.shoppingList.list(householdId, {
      search: params?.search,
      categories: params?.categories,
      boughtState: params?.boughtState,
    }),
    queryFn: ({ pageParam }) =>
      shoppingListApi.listItems(householdId, {
        ...params,
        cursor: pageParam as string | undefined,
        limit: ACTIVE_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ShoppingListResult) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function useBoughtShoppingItems(householdId: string) {
  return useQuery({
    queryKey: queryKeys.shoppingList.bought(householdId),
    queryFn: () =>
      shoppingListApi.listItems(householdId, { boughtState: 'bought', limit: 100 }),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    select: (page) => page.items,
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

export function useUpdateShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ShoppingListItemResponse,
    Error,
    { itemId: string; input: UpdateShoppingItemInput }
  >({
    mutationFn: ({ itemId, input }) => shoppingListApi.updateItem(householdId, itemId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useToggleShoppingItemBought(householdId: string) {
  const queryClient = useQueryClient();
  const listPrefix = ['shoppingList', householdId, 'list'] as const;

  return useMutation<
    unknown,
    Error,
    string,
    { snapshots: Array<[readonly unknown[], InfiniteData<ShoppingListResult> | undefined]> }
  >({
    mutationFn: (itemId: string) => shoppingListApi.toggleBought(householdId, itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: listPrefix });
      const snapshots = queryClient.getQueriesData<InfiniteData<ShoppingListResult>>({ queryKey: listPrefix });
      queryClient.setQueriesData<InfiniteData<ShoppingListResult>>({ queryKey: listPrefix }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                // Re-sort by isBought ASC to match the server sort, so the
                // layout animation fires once on toggle instead of twice
                // (toggle in place, then again after refetch reorders).
                items: page.items
                  .map((i) =>
                    i._id === itemId ? { ...i, isBought: !i.isBought } : i
                  )
                  .sort((a, b) => Number(a.isBought) - Number(b.isBought)),
              })),
            }
          : old
      );
      return { snapshots };
    },
    onError: (_err, _itemId, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
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

export function useArchiveShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShoppingListItemResponse, Error, string>({
    mutationFn: (itemId: string) => shoppingListApi.archiveItem(householdId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useRestoreShoppingItem(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShoppingListItemResponse, Error, string>({
    mutationFn: (itemId: string) => shoppingListApi.restoreItem(householdId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
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

export function useArchiveBoughtShoppingItems(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    { archivedCount: number },
    Error,
    { expenseId: string; dominantCategory: ExpenseType }
  >({
    mutationFn: (input) => shoppingListApi.archiveBought(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all(householdId) });
    },
  });
}

export function useArchivedHistory(
  householdId: string,
  filter?: Pick<ShoppingListFilter, 'search' | 'categories'>
) {
  const params = filter
    ? {
        search: filter.search.trim() || undefined,
        categories: filter.categories.length > 0 ? filter.categories : undefined,
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.shoppingList.history(householdId, {
      search: params?.search,
      categories: params?.categories,
    }),
    queryFn: ({ pageParam }) =>
      shoppingListApi.listArchivedHistory(householdId, {
        cursor: pageParam as string | undefined,
        limit: 10,
        ...params,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: HistoryPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
