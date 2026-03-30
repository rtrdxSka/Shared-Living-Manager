import { body, param, ValidationChain } from 'express-validator';
import { EXPENSE_TYPES } from '../types/household.types';
import { RECURRENCE_INTERVALS, PAYER_MODES } from '../types/recurring-expense.types';

export const recurringExpenseIdValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('recurringId').isMongoId().withMessage('Invalid recurring expense ID'),
];

export const createRecurringExpenseValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),

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

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('interval')
    .isIn([...RECURRENCE_INTERVALS])
    .withMessage('interval must be monthly or weekly'),

  body('payerMode')
    .isIn([...PAYER_MODES])
    .withMessage('payerMode must be fixed or open_to_claim'),

  body('fixedPayerUserId')
    .if(body('payerMode').equals('fixed'))
    .notEmpty()
    .withMessage('fixedPayerUserId is required when payerMode is fixed')
    .isMongoId()
    .withMessage('Invalid fixedPayerUserId'),

  body('fixedPayerUserId')
    .if(body('payerMode').equals('open_to_claim'))
    .optional()
    .isMongoId()
    .withMessage('Invalid fixedPayerUserId'),
];

export const updateRecurringExpenseValidation: ValidationChain[] = [
  ...recurringExpenseIdValidation,

  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Description must be between 1 and 100 characters'),

  body('amount')
    .optional()
    .isFloat({ min: 0.01, max: 1_000_000 })
    .withMessage('Amount must be between 0.01 and 1,000,000'),

  body('category')
    .optional()
    .isIn([...EXPENSE_TYPES])
    .withMessage('Invalid expense category'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('interval')
    .optional()
    .isIn([...RECURRENCE_INTERVALS])
    .withMessage('interval must be monthly or weekly'),

  body('payerMode')
    .optional()
    .isIn([...PAYER_MODES])
    .withMessage('payerMode must be fixed or open_to_claim'),

  body('fixedPayerUserId')
    .optional()
    .isMongoId()
    .withMessage('Invalid fixedPayerUserId'),
];
