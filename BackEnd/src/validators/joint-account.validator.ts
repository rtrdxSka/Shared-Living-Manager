import { body, param, query, ValidationChain } from 'express-validator';
import { TRANSACTION_TYPES, CONTRIBUTION_TARGET_MODES } from '../types/joint-account.types';
import { paginationValidation } from './pagination.validator';

const householdIdParam: ValidationChain = param('id')
  .isMongoId()
  .withMessage('Invalid household ID');

export const getSummaryValidation: ValidationChain[] = [
  householdIdParam,

  query('month')
    .optional()
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Month must be in YYYY-MM format'),

  ...paginationValidation,
];

export const addTransactionValidation: ValidationChain[] = [
  householdIdParam,

  body('type')
    .isIn([...TRANSACTION_TYPES])
    .withMessage(`Type must be one of: ${TRANSACTION_TYPES.join(', ')}`),

  body('amount')
    .isFloat({ min: 0.01, max: 1_000_000 })
    .withMessage('Amount must be between 0.01 and 1,000,000'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Note cannot exceed 200 characters'),
];

export const deleteTransactionValidation: ValidationChain[] = [
  householdIdParam,

  param('txId')
    .isMongoId()
    .withMessage('Invalid transaction ID'),
];

export const updateConfigValidation: ValidationChain[] = [
  householdIdParam,

  body('monthlyTarget')
    .optional({ values: 'null' })
    .isFloat({ min: 0.01, max: 1_000_000 })
    .withMessage('Monthly target must be between 0.01 and 1,000,000'),

  body('targetMode')
    .optional()
    .isIn([...CONTRIBUTION_TARGET_MODES])
    .withMessage(`Target mode must be one of: ${CONTRIBUTION_TARGET_MODES.join(', ')}`),
];
