import { Document, Types } from 'mongoose';
import { ExpenseType } from './household.types';

export const RECURRENCE_INTERVALS = ['monthly', 'weekly'] as const;
export type RecurrenceInterval = (typeof RECURRENCE_INTERVALS)[number];

export const PAYER_MODES = ['fixed', 'open_to_claim'] as const;
export type PayerMode = (typeof PAYER_MODES)[number];

export interface IRecurringExpense extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  description: string;
  amount: number;
  category: ExpenseType;
  notes?: string;
  interval: RecurrenceInterval;
  payerMode: PayerMode;
  fixedPayerUserId?: Types.ObjectId;
  isActive: boolean;
  isFullRepayment: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateRecurringExpenseInput {
  description: string;
  amount: number;
  category: ExpenseType;
  notes?: string;
  interval: RecurrenceInterval;
  payerMode: PayerMode;
  fixedPayerUserId?: string; // required when payerMode === 'fixed'
  isFullRepayment?: boolean;
}

export interface IUpdateRecurringExpenseInput {
  description?: string;
  amount?: number;
  category?: ExpenseType;
  notes?: string;
  interval?: RecurrenceInterval;
  payerMode?: PayerMode;
  fixedPayerUserId?: string;
  isFullRepayment?: boolean;
}

export interface IRecurringExpenseResponse {
  _id: string;
  householdId: string;
  createdByUserId: string;
  description: string;
  amount: number;
  category: ExpenseType;
  notes?: string;
  interval: RecurrenceInterval;
  payerMode: PayerMode;
  fixedPayerUserId?: string;
  fixedPayerNickname?: string; // resolved from household members
  isActive: boolean;
  isFullRepayment: boolean;
  createdAt: string;
  updatedAt: string;
}
