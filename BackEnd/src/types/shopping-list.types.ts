import { Document, Types } from 'mongoose';

export interface IShoppingListItem extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  quantity?: string;
  notes?: string;
  addedByUserId: Types.ObjectId;
  isBought: boolean;
  boughtAt?: Date;
  boughtByMemberId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddShoppingItemInput {
  name: string;
  quantity?: string;
  notes?: string;
}

export interface IShoppingListItemResponse {
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
