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

// POST /api/households/:id/expenses/:expenseId/resolve
router.post(
  '/:expenseId/resolve',
  authMiddleware,
  emailVerifiedMiddleware,
  expenseIdValidation,
  handleValidationErrors,
  expenseController.resolveExpense.bind(expenseController)
);

export default router;
