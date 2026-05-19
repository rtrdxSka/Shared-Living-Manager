import type { ExpenseType } from '@/types/onboarding.types';

export const CATEGORY_LABELS: Record<ExpenseType, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  internet: 'Internet',
  groceries: 'Groceries',
  cleaning: 'Cleaning',
  subscriptions: 'Subscriptions',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<ExpenseType, string> = {
  rent: 'hsl(var(--cat-rent))',
  utilities: 'hsl(var(--cat-utilities))',
  internet: 'hsl(var(--cat-internet))',
  groceries: 'hsl(var(--cat-groceries))',
  cleaning: 'hsl(var(--cat-cleaning))',
  subscriptions: 'hsl(var(--cat-subscriptions))',
  other: 'hsl(var(--cat-other))',
};
