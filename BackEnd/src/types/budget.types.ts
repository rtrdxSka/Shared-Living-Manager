import { Document, Types } from 'mongoose';
import type { ExpenseType } from './household.types';

export { EXPENSE_TYPES as BUDGET_CATEGORIES } from './household.types';

export type IBudgetCategories = Partial<Record<ExpenseType, number>>;

export interface IBudget extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  categories: IBudgetCategories;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBudgetSnapshot extends Document {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  monthString: string; // "YYYY-MM"
  categories: IBudgetCategories;
  frozenAt: Date;
}

export interface BudgetUpdateRequest {
  categories: IBudgetCategories;
}

export interface BudgetMonthlyTrendPoint {
  monthString: string; // "YYYY-MM"
  totalSpent: number;
}

export interface BudgetInsightsResponse {
  month: string; // "YYYY-MM"
  budget: IBudgetCategories;
  budgetSource: 'live' | 'snapshot';
  spendByCategory: IBudgetCategories;
  totalSpent: number;
  totalBudgeted: number;
  monthlyTrend: BudgetMonthlyTrendPoint[];
  savingsRate: number | null;
  monthlyIncome: number | null;
  overBudgetCategories: ExpenseType[];
}
