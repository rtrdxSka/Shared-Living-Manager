import { Router } from 'express';
import { recurringTaskController } from '../controllers/recurring-task.controller';
import {
  createRecurringTaskValidation,
  updateRecurringTaskValidation,
  recurringTaskIdValidation,
} from '../validators/recurring-task.validator';
import { param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// POST /api/households/:id/recurring-tasks
router.post(
  '/',
  authMiddleware,
  createRecurringTaskValidation,
  handleValidationErrors,
  recurringTaskController.create.bind(recurringTaskController)
);

// GET /api/households/:id/recurring-tasks
router.get(
  '/',
  authMiddleware,
  [param('id').isMongoId().withMessage('Invalid household ID')],
  handleValidationErrors,
  recurringTaskController.list.bind(recurringTaskController)
);

// PATCH /api/households/:id/recurring-tasks/:recurringTaskId
router.patch(
  '/:recurringTaskId',
  authMiddleware,
  updateRecurringTaskValidation,
  handleValidationErrors,
  recurringTaskController.update.bind(recurringTaskController)
);

// DELETE /api/households/:id/recurring-tasks/:recurringTaskId (soft-delete)
router.delete(
  '/:recurringTaskId',
  authMiddleware,
  recurringTaskIdValidation,
  handleValidationErrors,
  recurringTaskController.deactivate.bind(recurringTaskController)
);

export default router;
