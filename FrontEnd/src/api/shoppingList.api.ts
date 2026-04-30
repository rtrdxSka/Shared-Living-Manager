import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type { ShoppingListItemResponse, AddShoppingItemInput } from '@/types/shoppingList.types';

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

  async toggleBought(householdId: string, itemId: string): Promise<ShoppingListItemResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ item: ShoppingListItemResponse }>>(
      `/households/${householdId}/shopping-list/${itemId}/bought`
    );
    return data.data.item;
  },

  async deleteItem(householdId: string, itemId: string): Promise<void> {
    await api.delete(`/households/${householdId}/shopping-list/${itemId}`);
  },

  async clearBought(householdId: string): Promise<{ deletedCount: number }> {
    const { data } = await api.post<ApiSuccessResponse<{ deletedCount: number }>>(
      `/households/${householdId}/shopping-list/clear-bought`
    );
    return data.data;
  },
};
