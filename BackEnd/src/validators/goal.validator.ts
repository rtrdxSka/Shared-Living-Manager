import { body, param, query, ValidationChain } from 'express-validator';
import { GOAL_CATEGORIES } from '../types/goal.types';
import { paginationValidation } from './pagination.validator';

const householdIdParam: ValidationChain = param('id')
  .isMongoId()
  .withMessage('Invalid household ID');

const goalIdParam: ValidationChain = param('goalId')
  .isMongoId()
  .withMessage('Invalid goal ID');

export const addGoalValidation: ValidationChain[] = [
  householdIdParam,

  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('targetAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Target amount must be at least 0.01'),

  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid ISO 8601 date'),

  body('category')
    .optional()
    .isIn(GOAL_CATEGORIES)
    .withMessage(`Category must be one of: ${GOAL_CATEGORIES.join(', ')}`),
];

export const listGoalsValidation: ValidationChain[] = [
  householdIdParam,

  query('status')
    .optional()
    .isIn(['active', 'completed', 'abandoned'])
    .withMessage('Status must be one of: active, completed, abandoned'),

  ...paginationValidation,
];

export const goalIdValidation: ValidationChain[] = [
  householdIdParam,
  goalIdParam,
];

export const updateGoalValidation: ValidationChain[] = [
  householdIdParam,
  goalIdParam,

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('targetAmount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Target amount must be at least 0.01'),

  body('deadline')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Deadline must be a valid ISO 8601 date'),

  body('category')
    .optional()
    .isIn(GOAL_CATEGORIES)
    .withMessage(`Category must be one of: ${GOAL_CATEGORIES.join(', ')}`),

  body('status')
    .optional()
    .isIn(['completed', 'abandoned'])
    .withMessage('Status must be one of: completed, abandoned'),
];

export const addContributionValidation: ValidationChain[] = [
  householdIdParam,
  goalIdParam,

  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be at least 0.01'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Note cannot exceed 200 characters'),
];

export const removeContributionValidation: ValidationChain[] = [
  householdIdParam,
  goalIdParam,

  param('contributionId')
    .isMongoId()
    .withMessage('Invalid contribution ID'),
];
