import { Document, Types } from 'mongoose';
import { ExpenseType } from './household.types';

export interface IExpenseDebtorState {
  userId: Types.ObjectId;
  share: number;
  claimedAt?: Date;
  confirmedAt?: Date;
  disputedAt?: Date;
}

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
  participantUserIds?: Types.ObjectId[];
  customSplitOverrides?: { userId: Types.ObjectId; pct: number }[];
  debtorStates: IExpenseDebtorState[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddExpenseInput {
  description: string;
  amount: number;
  category: ExpenseType;
  date: string;
  notes?: string;
  paidByUserId?: string;
  isFullRepayment?: boolean;
  participantUserIds?: string[];
  customSplitOverrides?: { userId: string; pct: number }[];
}

export type ExpenseStatus = 'unresolved' | 'pending' | 'resolved';

export interface IListExpensesInput {
  month?: string;
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

export interface IExpenseDebtorStateResponse {
  userId: string;
  nickname?: string;
  share: number;
  claimedAt?: string;
  confirmedAt?: string;
  disputedAt?: string;
}

export interface IExpenseResponse {
  _id: string;
  householdId: string;
  paidByUserId?: string;
  paidByNickname?: string;
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
  participantUserIds?: string[];
  customSplitOverrides?: { userId: string; pct: number }[];
  debtorStates: IExpenseDebtorStateResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface IUpdateExpenseInput {
  description?: string;
  amount?: number;
  category?: ExpenseType;
  date?: string;
  notes?: string;
  paidByUserId?: string | null;
  isFullRepayment?: boolean;
  participantUserIds?: string[] | null;
  customSplitOverrides?: { userId: string; pct: number }[];
}

export interface IClaimExpenseInput { /* empty — auth provides claimant */ }
export interface IClaimPaybackInput { /* empty — auth provides debtor */ }
export interface IConfirmPaybackInput { debtorUserId: string }
export interface IDisputePaybackInput { debtorUserId: string }
