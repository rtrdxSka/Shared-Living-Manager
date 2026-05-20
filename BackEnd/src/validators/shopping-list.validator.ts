import { body, param, query, ValidationChain } from 'express-validator';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

export const addShoppingItemValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('quantity')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Quantity cannot exceed 50 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('category')
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),
];

export const updateShoppingItemValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('itemId')
    .isMongoId()
    .withMessage('Invalid shopping list item ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('quantity')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Quantity cannot exceed 50 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('category')
    .optional()
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid category'),
];

export const shoppingItemIdValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('itemId')
    .isMongoId()
    .withMessage('Invalid shopping list item ID'),
];

export const householdIdOnlyValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ max: 120 })
    .withMessage('Search cannot exceed 120 characters'),

  query('categories')
    .optional()
    .toArray()
    .custom((value: unknown) => {
      if (!Array.isArray(value)) return false;
      return value.every((v) => typeof v === 'string' && EXPENSE_TYPE_VALUES.includes(v as typeof EXPENSE_TYPE_VALUES[number]));
    })
    .withMessage('Each category must be a valid expense type'),

  query('boughtState')
    .optional()
    .isIn(['bought', 'unbought', 'all'])
    .withMessage('boughtState must be one of: bought, unbought, all'),

  query('archived')
    .optional()
    .isBoolean()
    .withMessage('archived must be a boolean')
    .toBoolean(),

  query('cursor')
    .optional()
    .isString()
    .withMessage('cursor must be a string')
    .isLength({ max: 100 })
    .withMessage('cursor cannot exceed 100 characters'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
];

export const archiveBoughtValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  body('expenseId')
    .isMongoId()
    .withMessage('Invalid expense ID'),

  body('dominantCategory')
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage('Invalid dominant category'),
];

export const historyValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  query('cursor')
    .optional()
    .isString()
    .withMessage('cursor must be a string')
    .isLength({ max: 100 })
    .withMessage('cursor cannot exceed 100 characters'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ max: 120 })
    .withMessage('Search cannot exceed 120 characters'),

  query('categories')
    .optional()
    .toArray()
    .custom((value: unknown) => {
      if (!Array.isArray(value)) return false;
      return value.every((v) => typeof v === 'string' && EXPENSE_TYPE_VALUES.includes(v as typeof EXPENSE_TYPE_VALUES[number]));
    })
    .withMessage('Each category must be a valid expense type'),
];
