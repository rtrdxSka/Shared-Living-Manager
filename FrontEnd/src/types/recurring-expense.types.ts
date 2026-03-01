import type { ExpenseType } from './onboarding.types';

export const RECURRENCE_INTERVALS = ['monthly', 'weekly'] as const;
export type RecurrenceInterval = (typeof RECURRENCE_INTERVALS)[number];

export const PAYER_MODES = ['fixed', 'open_to_claim'] as const;
export type PayerMode = (typeof PAYER_MODES)[number];

export interface RecurringExpenseResponse {
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
  fixedPayerNickname?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringExpenseInput {
  description: string;
  amount: number;
  category: ExpenseType;
  notes?: string;
  interval: RecurrenceInterval;
  payerMode: PayerMode;
  fixedPayerUserId?: string;
}

export interface UpdateRecurringExpenseInput {
  description?: string;
  amount?: number;
  category?: ExpenseType;
  notes?: string;
  interval?: RecurrenceInterval;
  payerMode?: PayerMode;
  fixedPayerUserId?: string;
}
