import { body, param, ValidationChain } from 'express-validator';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

const CADENCE_VALUES = ['daily', 'weekly', 'monthly'] as const;

export const householdIdParamValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),
];

export const ruleIdParamValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('ruleId')
    .isMongoId()
    .withMessage('Invalid rule ID'),
];

export const createRuleValidation: ValidationChain[] = [
  ...householdIdParamValidation,

  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('category')
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),

  body('cadence')
    .isIn(CADENCE_VALUES)
    .withMessage('Cadence must be one of: daily, weekly, monthly'),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('active must be a boolean'),
];

export const updateRuleValidation: ValidationChain[] = [
  ...ruleIdParamValidation,

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('category')
    .optional()
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),

  body('cadence')
    .optional()
    .isIn(CADENCE_VALUES)
    .withMessage('Cadence must be one of: daily, weekly, monthly'),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('active must be a boolean'),
];
