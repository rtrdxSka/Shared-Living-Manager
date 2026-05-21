import type { ExpenseType } from './onboarding.types';

export type ExpenseStatusFilter = 'unresolved' | 'pending' | 'resolved';

export interface ExpenseFilters {
  search: string;
  categories: ExpenseType[];
  paidBy: string[];
  status: ExpenseStatusFilter | null;
}

export const EMPTY_EXPENSE_FILTERS: ExpenseFilters = {
  search: '',
  categories: [],
  paidBy: [],
  status: null,
};

export interface ExpenseDebtorState {
  userId: string;
  nickname?: string;
  share: number;
  claimedAt?: string;
  confirmedAt?: string;
  disputedAt?: string;
}

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
  isFullRepayment: boolean;
  resolvedAt?: string;
  participantUserIds?: string[];
  customSplitOverrides?: { userId: string; pct: number }[];
  debtorStates: ExpenseDebtorState[];
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
  isFullRepayment?: boolean;
  participantUserIds?: string[];
  customSplitOverrides?: { userId: string; pct: number }[];
}

export interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  category?: ExpenseType;
  date?: string;
  notes?: string;
  paidByUserId?: string | null;
  isFullRepayment?: boolean;
  // Pass `null` or `[]` to clear the subgroup ("go back to all members").
  participantUserIds?: string[] | null;
  customSplitOverrides?: { userId: string; pct: number }[];
}
