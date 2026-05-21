import { body, param, query, ValidationChain } from 'express-validator';
import { EXPENSE_TYPES } from '../types/household.types';
import { cursorPaginationValidation } from './pagination.validator';

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

  body('isFullRepayment')
    .optional()
    .isBoolean()
    .toBoolean()
    .withMessage('isFullRepayment must be a boolean'),
];

export const claimExpenseValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('expenseId').isMongoId().withMessage('Invalid expense ID'),
];

export const expenseIdValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('expenseId').isMongoId().withMessage('Invalid expense ID'),
];

export const claimPaybackValidation: ValidationChain[] = [...expenseIdValidation];

export const confirmPaybackValidation: ValidationChain[] = [
  ...expenseIdValidation,
  body('debtorUserId').isMongoId().withMessage('debtorUserId must be a valid user ID'),
];

export const disputePaybackValidation: ValidationChain[] = [
  ...expenseIdValidation,
  body('debtorUserId').isMongoId().withMessage('debtorUserId must be a valid user ID'),
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
  body('isFullRepayment')
    .optional()
    .isBoolean()
    .toBoolean()
    .withMessage('isFullRepayment must be a boolean'),
];

export const listExpensesValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  query('month')
    .optional()
    .matches(/^(\d{4}-(0[1-9]|1[0-2])|all)$/)
    .withMessage('month must be in YYYY-MM format or "all"'),

  query('search')
    .optional()
    .isString()
    .isLength({ max: 120 })
    .withMessage('search must be a string up to 120 characters'),

  query('categories')
    .optional()
    .toArray()
    .isArray()
    .withMessage('categories must be an array'),
  query('categories.*')
    .optional()
    .isIn([...EXPENSE_TYPES])
    .withMessage('Invalid expense category'),

  query('paidBy')
    .optional()
    .toArray()
    .isArray()
    .withMessage('paidBy must be an array'),
  query('paidBy.*')
    .optional()
    .isMongoId()
    .withMessage('Each paidBy entry must be a valid user ID'),

  query('status')
    .optional()
    .isIn(['unresolved', 'pending', 'resolved'])
    .withMessage('status must be one of: unresolved, pending, resolved'),

  ...cursorPaginationValidation,
];
