import { Router } from 'express';
import { budgetController } from '../controllers/budget.controller';
import {
  getBudgetValidation,
  updateBudgetValidation,
  budgetMonthQueryValidation,
} from '../validators/budget.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/households/:id/budget
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  getBudgetValidation,
  handleValidationErrors,
  budgetController.getBudget.bind(budgetController)
);

// PUT /api/households/:id/budget
router.put(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  updateBudgetValidation,
  handleValidationErrors,
  budgetController.updateBudget.bind(budgetController)
);

// GET /api/households/:id/budget/snapshot?month=YYYY-MM
router.get(
  '/snapshot',
  authMiddleware,
  emailVerifiedMiddleware,
  budgetMonthQueryValidation,
  handleValidationErrors,
  budgetController.getSnapshot.bind(budgetController)
);

// GET /api/households/:id/budget/insights?month=YYYY-MM
router.get(
  '/insights',
  authMiddleware,
  emailVerifiedMiddleware,
  budgetMonthQueryValidation,
  handleValidationErrors,
  budgetController.getInsights.bind(budgetController)
);

export default router;
