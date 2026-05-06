import { Document, Types } from 'mongoose';
import { ExpenseType } from './household.types';

export type RecurrenceCadence = 'daily' | 'weekly' | 'monthly';

export interface IRecurringShoppingItem extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecurringShoppingItemPayload {
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active?: boolean;
}

export interface IRecurringShoppingItemResponse {
  _id: string;
  householdId: string;
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IFireRulesResult {
  created: number;
  skipped: number;
}
