export interface ShoppingListItemResponse {
  _id: string;
  householdId: string;
  name: string;
  quantity?: string;
  notes?: string;
  addedByUserId: string;
  isBought: boolean;
  boughtAt?: string;
  boughtByMemberId?: string;
  boughtByNickname?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
}
