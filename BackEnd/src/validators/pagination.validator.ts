import { query, ValidationChain } from 'express-validator';

export const paginationValidation: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
];

export const cursorPaginationValidation: ValidationChain[] = [
  query('cursor')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('cursor must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
];
