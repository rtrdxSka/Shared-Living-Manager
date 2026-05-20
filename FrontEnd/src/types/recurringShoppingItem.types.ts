import type { ExpenseType } from './onboarding.types';

export type RecurrenceCadence = 'daily' | 'weekly' | 'monthly';

export interface RecurringShoppingItemResponse {
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

export interface CreateRecurringShoppingItemInput {
  name: string;
  category: ExpenseType;
  cadence: RecurrenceCadence;
  active?: boolean;
}

export interface UpdateRecurringShoppingItemInput {
  name?: string;
  category?: ExpenseType;
  cadence?: RecurrenceCadence;
  active?: boolean;
}
