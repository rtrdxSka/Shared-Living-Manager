import { body, param, ValidationChain } from 'express-validator';

export const addTaskValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
];

export const taskIdValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('taskId')
    .isMongoId()
    .withMessage('Invalid task ID'),
];

export const setRotationValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  body('startMemberId')
    .isMongoId()
    .withMessage('startMemberId must be a valid ID'),
];
