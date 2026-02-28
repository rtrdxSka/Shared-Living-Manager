import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { addExpenseValidation, listExpensesValidation, expenseIdValidation, updateExpenseValidation } from '../validators/expense.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true }); // exposes :id from household router

// POST /api/households/:id/expenses
router.post(
  '/',
  authMiddleware,
  addExpenseValidation,
  handleValidationErrors,
  expenseController.addExpense.bind(expenseController)
);

// GET /api/households/:id/expenses
router.get(
  '/',
  authMiddleware,
  listExpensesValidation,
  handleValidationErrors,
  expenseController.listExpenses.bind(expenseController)
);

// DELETE /api/households/:id/expenses/:expenseId
router.delete(
  '/:expenseId',
  authMiddleware,
  expenseIdValidation,
  handleValidationErrors,
  expenseController.deleteExpense.bind(expenseController)
);

// PATCH /api/households/:id/expenses/:expenseId
router.patch(
  '/:expenseId',
  authMiddleware,
  updateExpenseValidation,
  handleValidationErrors,
  expenseController.updateExpense.bind(expenseController)
);

export default router;
