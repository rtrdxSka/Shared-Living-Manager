import type { ExpenseType } from './onboarding.types';

export { EXPENSE_TYPES as BUDGET_CATEGORIES } from './onboarding.types';

export type BudgetCategories = Partial<Record<ExpenseType, number>>;

export interface Budget {
  _id: string;
  householdId: string;
  categories: BudgetCategories;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetUpdateRequest {
  categories: BudgetCategories;
}

export interface BudgetMonthlyTrendPoint {
  monthString: string;
  totalSpent: number;
}

export interface BudgetInsights {
  month: string;
  budget: BudgetCategories;
  budgetSource: 'live' | 'snapshot';
  spendByCategory: BudgetCategories;
  totalSpent: number;
  totalBudgeted: number;
  monthlyTrend: BudgetMonthlyTrendPoint[];
  savingsRate: number | null;
  monthlyIncome: number | null;
  overBudgetCategories: ExpenseType[];
}

export interface BudgetSnapshotResult {
  categories: BudgetCategories;
  source: 'live' | 'snapshot';
}
