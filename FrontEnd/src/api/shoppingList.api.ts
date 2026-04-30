import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  ShoppingListItemResponse,
  AddShoppingItemInput,
  UpdateShoppingItemInput,
  HistoryPage,
} from '@/types/shoppingList.types';
import type { ExpenseType } from '@/types/onboarding.types';

export interface ShoppingListResult {
  items: ShoppingListItemResponse[];
}

export const shoppingListApi = {
  async listItems(householdId: string): Promise<ShoppingListResult> {
    const { data } = await api.get<ApiSuccessResponse<ShoppingListResult>>(
      `/households/${householdId}/shopping-list`
    );
    return data.data;
  },

  async addItem(householdId: string, input: AddShoppingItemInput): Promise<ShoppingListItemResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list`,
      input
    );
    return data.data.item;
  },

  async updateItem(
    householdId: string,
    itemId: string,
    input: UpdateShoppingItemInput
  ): Promise<ShoppingListItemResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}`,
      input
    );
    return data.data.item;
  },

  async toggleBought(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/bought`
    );
    return data.data.item;
  },

  async archiveItem(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/archive`
    );
    return data.data.item;
  },

  async restoreItem(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/restore`
    );
    return data.data.item;
  },

  async deleteItem(householdId: string, itemId: string): Promise<void> {
    await api.delete(`/households/${householdId}/shopping-list/${itemId}`);
  },

  async archiveBought(
    householdId: string,
    input: { expenseId: string; dominantCategory: ExpenseType }
  ): Promise<{ archivedCount: number }> {
    const { data } = await api.post<ApiSuccessResponse<{ archivedCount: number }>>(
      `/households/${householdId}/shopping-list/archive-bought`,
      input
    );
    return data.data;
  },

  async listArchivedHistory(
    householdId: string,
    params: { cursor?: string; limit?: number } = {}
  ): Promise<HistoryPage> {
    const { data } = await api.get<ApiSuccessResponse<HistoryPage>>(
      `/households/${householdId}/shopping-list/history`,
      { params }
    );
    return data.data;
  },
};
