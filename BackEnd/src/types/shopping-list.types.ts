import { Document, Types } from 'mongoose';
import { ExpenseType } from './household.types';

export interface IShoppingListItem extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
  addedByUserId: Types.ObjectId;
  isBought: boolean;
  boughtAt?: Date;
  boughtByMemberId?: Types.ObjectId;
  archivedAt?: Date;
  archivedExpenseId?: Types.ObjectId;
  archivedDominantCategory?: ExpenseType;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
  category: ExpenseType;
}

export interface IUpdateShoppingItemInput {
  name?: string;
  quantity?: string;
  notes?: string;
  category?: ExpenseType;
}

export interface IArchiveBoughtInput {
  expenseId: string;
  dominantCategory: ExpenseType;
}

export interface IListHistoryInput {
  cursor?: string;
  limit?: number;
}

export type BoughtState = 'bought' | 'unbought' | 'all';

export interface IListItemsOptions {
  archived?: boolean;
  search?: string;
  categories?: ExpenseType[];
  boughtState?: BoughtState;
}

export interface IListHistoryOptions {
  cursor?: string;
  limit?: number;
  search?: string;
  categories?: ExpenseType[];
}

export interface IShoppingListItemResponse {
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

export type HistoryEntry =
  | {
      type: 'trip';
      archivedAt: string;
      items: IShoppingListItemResponse[];
      expenseId: string;
      dominantCategory: ExpenseType;
    }
  | {
      type: 'manual';
      archivedAt: string;
      items: IShoppingListItemResponse[];
    };

export interface IListHistoryResult {
  entries: HistoryEntry[];
  nextCursor: string | null;
}
