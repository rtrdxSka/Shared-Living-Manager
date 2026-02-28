import { Document, Types } from 'mongoose';
import { ExpenseType } from './household.types';

export interface IExpense extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  paidByUserId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  description: string;
  amount: number;
  category: ExpenseType;
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddExpenseInput {
  description: string;
  amount: number;
  category: ExpenseType;
  date: string;         // "YYYY-MM-DD" from client
  notes?: string;
  paidByUserId: string;
}

export interface IListExpensesInput {
  month?: string;       // "YYYY-MM" — defaults to current month
  category?: ExpenseType;
}

export interface IExpenseResponse {
  _id: string;
  householdId: string;
  paidByUserId: string;
  paidByNickname: string;  // resolved from household.members
  createdByUserId: string;
  description: string;
  amount: number;
  category: ExpenseType;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IUpdateExpenseInput {
  description?: string;
  amount?: number;
  category?: ExpenseType;
  date?: string;      // "YYYY-MM-DD"
  notes?: string;
  paidByUserId?: string;
}
