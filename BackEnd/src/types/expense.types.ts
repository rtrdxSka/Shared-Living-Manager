import { Document, Types } from 'mongoose';
import { ExpenseType } from './household.types';

export interface IExpense extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  paidByUserId?: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  description: string;
  amount: number;
  category: ExpenseType;
  date: Date;
  notes?: string;
  recurringExpenseId?: Types.ObjectId;
  isResolved: boolean;
  isFullRepayment: boolean;
  resolvedAt?: Date;
  resolvedByUserId?: Types.ObjectId;
  pendingConfirmation: boolean;
  pendingConfirmationAt?: Date;
  pendingConfirmationByUserId?: Types.ObjectId;
  lastDisputedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddExpenseInput {
  description: string;
  amount: number;
  category: ExpenseType;
  date: string;         // "YYYY-MM-DD" from client
  notes?: string;
  paidByUserId?: string;
  isFullRepayment?: boolean;
}

export type ExpenseStatus = 'unresolved' | 'pending' | 'resolved';

export interface IListExpensesInput {
  month?: string;       // "YYYY-MM" or "all" — defaults to current month
  search?: string;
  categories?: ExpenseType[];
  paidBy?: string[];
  status?: ExpenseStatus;
  cursor?: string;
  limit?: number;
}

export interface IListExpensesResult {
  items: IExpenseResponse[];
  nextCursor: string | null;
}

export interface IExpenseResponse {
  _id: string;
  householdId: string;
  paidByUserId?: string;
  paidByNickname?: string;  // resolved from household.members
  createdByUserId: string;
  description: string;
  amount: number;
  category: ExpenseType;
  date: string;
  notes?: string;
  recurringExpenseId?: string;
  isResolved: boolean;
  isFullRepayment: boolean;
  resolvedAt?: string;
  resolvedByUserId?: string;
  pendingConfirmation: boolean;
  pendingConfirmationAt?: string;
  pendingConfirmationByUserId?: string;
  pendingConfirmationByNickname?: string;
  lastDisputedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IUpdateExpenseInput {
  description?: string;
  amount?: number;
  category?: ExpenseType;
  date?: string;      // "YYYY-MM-DD"
  notes?: string;
  paidByUserId?: string | null;
  isFullRepayment?: boolean;
}

export interface IClaimExpenseInput {
  // no body — auth provides the claimant identity
}
