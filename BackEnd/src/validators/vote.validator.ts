import { body, param, query, ValidationChain } from 'express-validator';
import {
  VOTE_STATUSES,
  VOTE_THRESHOLDS,
  BALLOT_CHOICES,
} from '../types/vote.types';

export const listVotesValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  query('status')
    .optional()
    .isIn(VOTE_STATUSES)
    .withMessage('Invalid status'),
];

export const createVoteValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
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
    .isIn(VOTE_THRESHOLDS)
    .withMessage('Invalid threshold'),
  body('deadlineDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('deadlineDays must be between 1 and 30'),
  body('sourceIssueId')
    .optional()
    .isMongoId()
    .withMessage('Invalid sourceIssueId'),
];

export const voteIdValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('voteId').isMongoId().withMessage('Invalid vote ID'),
];

export const castBallotValidation: ValidationChain[] = [
  ...voteIdValidation,
  body('choice')
    .isIn(BALLOT_CHOICES)
    .withMessage('choice must be yes/no/abstain'),
];
