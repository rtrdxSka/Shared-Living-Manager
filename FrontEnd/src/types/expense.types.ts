import type { ExpenseType } from './onboarding.types';

export interface ExpenseResponse {
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
  resolvedAt?: string;
  resolvedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddExpenseInput {
  description: string;
  amount: number;
  category: ExpenseType;
  date: string; // "YYYY-MM-DD"
  notes?: string;
  paidByUserId?: string;
}

export interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  category?: ExpenseType;
  date?: string;
  notes?: string;
  paidByUserId?: string | null;
}
