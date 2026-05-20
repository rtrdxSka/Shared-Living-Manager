import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { addExpenseValidation, listExpensesValidation, expenseIdValidation, updateExpenseValidation, claimExpenseValidation } from '../validators/expense.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true }); // exposes :id from household router

// POST /api/households/:id/expenses
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  addExpenseValidation,
  handleValidationErrors,
  expenseController.addExpense.bind(expenseController)
);

// GET /api/households/:id/expenses
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  listExpensesValidation,
  handleValidationErrors,
  expenseController.listExpenses.bind(expenseController)
);

// DELETE /api/households/:id/expenses/:expenseId
router.delete(
  '/:expenseId',
  authMiddleware,
  emailVerifiedMiddleware,
  expenseIdValidation,
  handleValidationErrors,
  expenseController.deleteExpense.bind(expenseController)
);

// PATCH /api/households/:id/expenses/:expenseId
router.patch(
  '/:expenseId',
  authMiddleware,
  emailVerifiedMiddleware,
  updateExpenseValidation,
  handleValidationErrors,
  expenseController.updateExpense.bind(expenseController)
);

// POST /api/households/:id/expenses/:expenseId/claim
router.post(
  '/:expenseId/claim',
  authMiddleware,
  emailVerifiedMiddleware,
  claimExpenseValidation,
  handleValidationErrors,
  expenseController.claimExpense.bind(expenseController)
);

// POST /api/households/:id/expenses/:expenseId/request-resolution
router.post(
  '/:expenseId/request-resolution',
  authMiddleware,
  emailVerifiedMiddleware,
  expenseIdValidation,
  handleValidationErrors,
  expenseController.requestResolution.bind(expenseController)
);

// POST /api/households/:id/expenses/:expenseId/confirm-resolution
router.post(
  '/:expenseId/confirm-resolution',
  authMiddleware,
  emailVerifiedMiddleware,
  expenseIdValidation,
  handleValidationErrors,
  expenseController.confirmResolution.bind(expenseController)
);

// POST /api/households/:id/expenses/:expenseId/dispute-resolution
router.post(
  '/:expenseId/dispute-resolution',
  authMiddleware,
  emailVerifiedMiddleware,
  expenseIdValidation,
  handleValidationErrors,
  expenseController.disputeResolution.bind(expenseController)
);

export default router;
