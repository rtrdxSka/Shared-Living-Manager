import { param, query, ValidationChain } from 'express-validator';

export const listRulesValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  query('includeArchived')
    .optional()
    .isBoolean()
    .withMessage('includeArchived must be boolean'),
];

export const ruleIdValidation: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid household ID'),
  param('ruleId').isMongoId().withMessage('Invalid rule ID'),
];
