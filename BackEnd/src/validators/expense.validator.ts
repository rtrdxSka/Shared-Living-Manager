import { body, param, query, ValidationChain } from 'express-validator';
import { EXPENSE_TYPES } from '../types/household.types';
import { paginationValidation } from './pagination.validator';

export const addExpenseValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  body('description')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Description must be between 1 and 100 characters'),

  body('amount')
    .isFloat({ min: 0.01, max: 1_000_000 })
    .withMessage('Amount must be between 0.01 and 1,000,000'),

  body('category')
    .isIn([...EXPENSE_TYPES])
    .withMessage('Invalid expense category'),

  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
    .custom((value: string) => {
      const date = new Date(value);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      if (date > oneYearFromNow) {
        throw new Error('Date cannot be more than 1 year in the future');
      }
      return true;
    }),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('paidByUserId')
    .optional()
    .isMongoId()
    .withMessage('Invalid paidByUserId'),
];

export const claimExpenseValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('expenseId').isMongoId().withMessage('Invalid expense ID'),
];

export const expenseIdValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('expenseId').isMongoId().withMessage('Invalid expense ID'),
];

export const updateExpenseValidation: ValidationChain[] = [
  ...expenseIdValidation,
  body('description').optional().trim().isLength({ min: 1, max: 100 })
    .withMessage('Description must be between 1 and 100 characters'),
  body('amount').optional().isFloat({ min: 0.01, max: 1_000_000 })
    .withMessage('Amount must be between 0.01 and 1,000,000'),
  body('category').optional().isIn([...EXPENSE_TYPES])
    .withMessage('Invalid expense category'),
  body('date').optional().isISO8601().withMessage('Date must be a valid ISO 8601 date')
    .custom((value: string) => {
      const date = new Date(value);
      const limit = new Date();
      limit.setFullYear(limit.getFullYear() + 1);
      if (date > limit) throw new Error('Date cannot be more than 1 year in the future');
      return true;
    }),
  body('notes').optional().trim().isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  body('paidByUserId').optional({ nullable: true })
    .if((value: unknown) => value !== null).isMongoId()
    .withMessage('Invalid paidByUserId'),
];

export const listExpensesValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  query('month')
    .optional()
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('month must be in YYYY-MM format'),

  query('category')
    .optional()
    .isIn([...EXPENSE_TYPES])
    .withMessage('Invalid expense category'),

  ...paginationValidation,
];
