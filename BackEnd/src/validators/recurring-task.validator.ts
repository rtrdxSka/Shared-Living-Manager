import { body, param, ValidationChain } from 'express-validator';
import { RECURRENCE_INTERVALS } from '../types/recurring-task.types';

export const createRecurringTaskValidation: ValidationChain[] = [
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

  body('interval')
    .isIn(RECURRENCE_INTERVALS)
    .withMessage(`interval must be one of: ${RECURRENCE_INTERVALS.join(', ')}`),

  body('assignedToMemberId')
    .optional()
    .isMongoId()
    .withMessage('assignedToMemberId must be a valid ID'),
];

export const recurringTaskIdValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('recurringTaskId')
    .isMongoId()
    .withMessage('Invalid recurring task ID'),
];

export const updateRecurringTaskValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),

  param('recurringTaskId')
    .isMongoId()
    .withMessage('Invalid recurring task ID'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('interval')
    .optional()
    .isIn(RECURRENCE_INTERVALS)
    .withMessage(`interval must be one of: ${RECURRENCE_INTERVALS.join(', ')}`),

  body('assignedToMemberId')
    .optional({ nullable: true })
    .if(body('assignedToMemberId').notEmpty())
    .isMongoId()
    .withMessage('assignedToMemberId must be a valid ID'),
];
