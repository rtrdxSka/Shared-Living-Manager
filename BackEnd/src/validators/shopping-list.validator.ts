import { body, param, ValidationChain } from 'express-validator';

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
];
