import { Router } from 'express';
import { recurringShoppingItemController } from '../controllers/recurring-shopping-item.controller';
import {
  householdIdParamValidation,
  ruleIdParamValidation,
  createRuleValidation,
  updateRuleValidation,
  previewMatchesValidation,
} from '../validators/recurring-shopping-item.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// POST /api/households/:id/shopping-list/recurring
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  createRuleValidation,
  handleValidationErrors,
  recurringShoppingItemController.createRule.bind(recurringShoppingItemController)
);

// GET /api/households/:id/shopping-list/recurring
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  householdIdParamValidation,
  handleValidationErrors,
  recurringShoppingItemController.listRules.bind(recurringShoppingItemController)
);

// POST /api/households/:id/shopping-list/recurring/preview-matches
// Must be registered BEFORE /:ruleId routes so the literal path segment
// `preview-matches` isn't captured as a Mongo ID.
router.post(
  '/preview-matches',
  authMiddleware,
  emailVerifiedMiddleware,
  previewMatchesValidation,
  handleValidationErrors,
  recurringShoppingItemController.previewMatches.bind(recurringShoppingItemController)
);

// PATCH /api/households/:id/shopping-list/recurring/:ruleId
router.patch(
  '/:ruleId',
  authMiddleware,
  emailVerifiedMiddleware,
  updateRuleValidation,
  handleValidationErrors,
  recurringShoppingItemController.updateRule.bind(recurringShoppingItemController)
);

// DELETE /api/households/:id/shopping-list/recurring/:ruleId
router.delete(
  '/:ruleId',
  authMiddleware,
  emailVerifiedMiddleware,
  ruleIdParamValidation,
  handleValidationErrors,
  recurringShoppingItemController.deleteRule.bind(recurringShoppingItemController)
);

export default router;
