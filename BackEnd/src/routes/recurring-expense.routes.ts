import { Router } from 'express';
import { recurringExpenseController } from '../controllers/recurring-expense.controller';
import {
  createRecurringExpenseValidation,
  updateRecurringExpenseValidation,
  recurringExpenseIdValidation,
} from '../validators/recurring-expense.validator';
import { param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true }); // exposes :id from household router

// POST /api/households/:id/recurring-expenses
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  createRecurringExpenseValidation,
  handleValidationErrors,
  recurringExpenseController.create.bind(recurringExpenseController)
);

// GET /api/households/:id/recurring-expenses
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  [param('id').isMongoId().withMessage('Invalid household ID')],
  handleValidationErrors,
  recurringExpenseController.list.bind(recurringExpenseController)
);

// PATCH /api/households/:id/recurring-expenses/:recurringId
router.patch(
  '/:recurringId',
  authMiddleware,
  emailVerifiedMiddleware,
  updateRecurringExpenseValidation,
  handleValidationErrors,
  recurringExpenseController.update.bind(recurringExpenseController)
);

// DELETE /api/households/:id/recurring-expenses/:recurringId (soft-delete)
router.delete(
  '/:recurringId',
  authMiddleware,
  emailVerifiedMiddleware,
  recurringExpenseIdValidation,
  handleValidationErrors,
  recurringExpenseController.deactivate.bind(recurringExpenseController)
);

export default router;
