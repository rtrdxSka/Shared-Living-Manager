import { Router } from 'express';
import { jointAccountController } from '../controllers/joint-account.controller';
import {
  getSummaryValidation,
  addTransactionValidation,
  deleteTransactionValidation,
  updateConfigValidation,
} from '../validators/joint-account.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/households/:id/joint-account
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  getSummaryValidation,
  handleValidationErrors,
  jointAccountController.getSummary.bind(jointAccountController)
);

// POST /api/households/:id/joint-account/transactions
router.post(
  '/transactions',
  authMiddleware,
  emailVerifiedMiddleware,
  addTransactionValidation,
  handleValidationErrors,
  jointAccountController.addTransaction.bind(jointAccountController)
);

// DELETE /api/households/:id/joint-account/transactions/:txId
router.delete(
  '/transactions/:txId',
  authMiddleware,
  emailVerifiedMiddleware,
  deleteTransactionValidation,
  handleValidationErrors,
  jointAccountController.deleteTransaction.bind(jointAccountController)
);

// PATCH /api/households/:id/joint-account/config
router.patch(
  '/config',
  authMiddleware,
  emailVerifiedMiddleware,
  updateConfigValidation,
  handleValidationErrors,
  jointAccountController.updateConfig.bind(jointAccountController)
);

export default router;
