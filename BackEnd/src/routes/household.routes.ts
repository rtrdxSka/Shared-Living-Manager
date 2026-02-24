import { Router } from 'express';
import { householdController } from '../controllers/household.controller';
import { createHouseholdValidation, joinHouseholdValidation } from '../validators/household.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/households — Create household from onboarding survey
router.post(
  '/',
  authMiddleware,
  createHouseholdValidation,
  handleValidationErrors,
  householdController.create.bind(householdController)
);

// POST /api/households/join — Join household via invite code
router.post(
  '/join',
  authMiddleware,
  joinHouseholdValidation,
  handleValidationErrors,
  householdController.join.bind(householdController)
);

export default router;
