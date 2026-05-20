import type { ExpenseType } from './onboarding.types';

export interface ShoppingListItemResponse {
  _id: string;
  householdId: string;
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
  addedByUserId: string;
  isBought: boolean;
  boughtAt?: string;
  boughtByMemberId?: string;
  boughtByNickname?: string;
  archivedAt?: string;
  archivedExpenseId?: string;
  archivedDominantCategory?: ExpenseType;
  createdAt: string;
  updatedAt: string;
}

export interface AddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
}

export interface UpdateShoppingItemInput {
  name?: string;
  quantity?: string;
  notes?: string;
  category?: ExpenseType;
}

export type HistoryEntry =
  | {
      type: 'trip';
      archivedAt: string;
      items: ShoppingListItemResponse[];
      expenseId: string;
      dominantCategory: ExpenseType;
    }
  | {
      type: 'manual';
      archivedAt: string;
      items: ShoppingListItemResponse[];
    };

export interface HistoryPage {
  entries: HistoryEntry[];
  nextCursor: string | null;
}

export type BoughtState = 'bought' | 'unbought' | 'all';

export interface ShoppingListFilter {
  search: string;
  categories: ExpenseType[];
  boughtState: BoughtState;
}
