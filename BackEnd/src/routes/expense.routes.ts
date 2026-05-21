import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { addExpenseValidation, listExpensesValidation, expenseIdValidation, updateExpenseValidation, claimExpenseValidation, claimPaybackValidation, confirmPaybackValidation, disputePaybackValidation } from '../validators/expense.validator';
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

// POST /api/households/:id/expenses/:expenseId/claim-payback
router.post(
  '/:expenseId/claim-payback',
  authMiddleware,
  emailVerifiedMiddleware,
  claimPaybackValidation,
  handleValidationErrors,
  expenseController.claimPayback.bind(expenseController)
);

// POST /api/households/:id/expenses/:expenseId/confirm-payback
router.post(
  '/:expenseId/confirm-payback',
  authMiddleware,
  emailVerifiedMiddleware,
  confirmPaybackValidation,
  handleValidationErrors,
  expenseController.confirmPayback.bind(expenseController)
);

// POST /api/households/:id/expenses/:expenseId/dispute-payback
router.post(
  '/:expenseId/dispute-payback',
  authMiddleware,
  emailVerifiedMiddleware,
  disputePaybackValidation,
  handleValidationErrors,
  expenseController.disputePayback.bind(expenseController)
);

export default router;
