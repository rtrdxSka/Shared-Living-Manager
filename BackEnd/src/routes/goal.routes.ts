import { Router } from 'express';
import { goalController } from '../controllers/goal.controller';
import {
  addGoalValidation,
  listGoalsValidation,
  goalIdValidation,
  updateGoalValidation,
  setGoalPriorityValidation,
  addContributionValidation,
  removeContributionValidation,
} from '../validators/goal.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// POST /api/households/:id/goals
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  addGoalValidation,
  handleValidationErrors,
  goalController.addGoal.bind(goalController)
);

// GET /api/households/:id/goals
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  listGoalsValidation,
  handleValidationErrors,
  goalController.listGoals.bind(goalController)
);

// GET /api/households/:id/goals/:goalId
router.get(
  '/:goalId',
  authMiddleware,
  emailVerifiedMiddleware,
  goalIdValidation,
  handleValidationErrors,
  goalController.getGoal.bind(goalController)
);

// PATCH /api/households/:id/goals/:goalId
router.patch(
  '/:goalId',
  authMiddleware,
  emailVerifiedMiddleware,
  updateGoalValidation,
  handleValidationErrors,
  goalController.updateGoal.bind(goalController)
);

// PATCH /api/households/:id/goals/:goalId/priority
router.patch(
  '/:goalId/priority',
  authMiddleware,
  emailVerifiedMiddleware,
  setGoalPriorityValidation,
  handleValidationErrors,
  goalController.setGoalPriority.bind(goalController)
);

// DELETE /api/households/:id/goals/:goalId
router.delete(
  '/:goalId',
  authMiddleware,
  emailVerifiedMiddleware,
  goalIdValidation,
  handleValidationErrors,
  goalController.deleteGoal.bind(goalController)
);

// POST /api/households/:id/goals/:goalId/contributions
router.post(
  '/:goalId/contributions',
  authMiddleware,
  emailVerifiedMiddleware,
  addContributionValidation,
  handleValidationErrors,
  goalController.addContribution.bind(goalController)
);

// DELETE /api/households/:id/goals/:goalId/contributions/:contributionId
router.delete(
  '/:goalId/contributions/:contributionId',
  authMiddleware,
  emailVerifiedMiddleware,
  removeContributionValidation,
  handleValidationErrors,
  goalController.removeContribution.bind(goalController)
);

export default router;
