import { Router } from 'express';
import { houseRuleController } from '../controllers/house-rule.controller';
import {
  listRulesValidation,
  ruleIdValidation,
} from '../validators/house-rule.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/households/:id/house-rules
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  listRulesValidation,
  handleValidationErrors,
  houseRuleController.list.bind(houseRuleController)
);

// POST /api/households/:id/house-rules/:ruleId/archive
router.post(
  '/:ruleId/archive',
  authMiddleware,
  emailVerifiedMiddleware,
  ruleIdValidation,
  handleValidationErrors,
  houseRuleController.archive.bind(houseRuleController)
);

// POST /api/households/:id/house-rules/:ruleId/restore
router.post(
  '/:ruleId/restore',
  authMiddleware,
  emailVerifiedMiddleware,
  ruleIdValidation,
  handleValidationErrors,
  houseRuleController.restore.bind(houseRuleController)
);

export default router;
