import { body, param, query, ValidationChain } from 'express-validator';
import { EXPENSE_TYPES } from '../types/household.types';
import type { ExpenseType } from '../types/household.types';

export const getBudgetValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
];

export const updateBudgetValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),

  body('categories')
    .exists({ checkNull: true })
    .withMessage('categories is required')
    .bail()
    .custom((value: unknown) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('categories must be an object');
      }
      for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
        if (!EXPENSE_TYPES.includes(key as ExpenseType)) {
          throw new Error(`Unknown category "${key}"`);
        }
        if (amount === undefined || amount === null) continue;
        if (typeof amount !== 'number' || Number.isNaN(amount) || amount < 0) {
          throw new Error(`Category "${key}" must be a non-negative number`);
        }
      }
      return true;
    }),
];

export const budgetMonthQueryValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  query('month')
    .exists({ checkFalsy: true })
    .withMessage('month query param is required')
    .bail()
    .matches(/^(\d{4}-(0[1-9]|1[0-2]))$/)
    .withMessage('month must be in YYYY-MM format'),
];
