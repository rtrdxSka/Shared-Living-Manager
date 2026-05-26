import { body, param, query, ValidationChain } from 'express-validator';
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from '../types/issue.types';

export const listIssuesValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  query('status')
    .optional()
    .isIn(ISSUE_STATUSES)
    .withMessage('Invalid status'),
  query('category')
    .optional()
    .isIn(ISSUE_CATEGORIES)
    .withMessage('Invalid category'),
  query('cursor').optional().isString().withMessage('cursor must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50'),
];

export const createIssueValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Title 1-120 chars'),
  body('body')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Body 1-2000 chars'),
  body('category')
    .isIn(ISSUE_CATEGORIES)
    .withMessage('Invalid category'),
];

export const issueIdValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('issueId').isMongoId().withMessage('Invalid issue ID'),
];

export const commentValidation: ValidationChain[] = [
  ...issueIdValidation,
  body('body')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment 1-1000 chars'),
];

export const commentIdValidation: ValidationChain[] = [
  ...issueIdValidation,
  param('commentId').isMongoId().withMessage('Invalid comment ID'),
];

export const escalateValidation: ValidationChain[] = [
  ...issueIdValidation,
  body('proposedRuleTitle')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('proposedRuleTitle 1-120 chars'),
  body('proposedRuleText')
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage('proposedRuleText 1-4000 chars'),
  body('threshold')
    .optional()
    .isIn(['simple_majority', 'supermajority', 'unanimous'])
    .withMessage('Invalid threshold'),
  body('deadlineDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('deadlineDays must be between 1 and 30'),
];
