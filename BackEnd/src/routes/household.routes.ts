import { Router } from 'express';
import { householdController } from '../controllers/household.controller';
import { createHouseholdValidation, joinHouseholdValidation, getHouseholdByIdValidation, updateSettingsValidation, updateMemberIncomeValidation, recordSettlementValidation } from '../validators/household.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';
import expenseRouter from './expense.routes';
import recurringExpenseRouter from './recurring-expense.routes';
import taskRouter from './task.routes';
import recurringTaskRouter from './recurring-task.routes';
import goalRouter from './goal.routes';
import jointAccountRouter from './joint-account.routes';

const router = Router();

// POST /api/households — Create household from onboarding survey
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  createHouseholdValidation,
  handleValidationErrors,
  householdController.create.bind(householdController)
);

// POST /api/households/join — Join household via invite code
router.post(
  '/join',
  authMiddleware,
  emailVerifiedMiddleware,
  joinHouseholdValidation,
  handleValidationErrors,
  householdController.join.bind(householdController)
);

// GET /api/households/:id — Get household by ID
router.get(
  '/:id',
  authMiddleware,
  emailVerifiedMiddleware,
  getHouseholdByIdValidation,
  handleValidationErrors,
  householdController.getById.bind(householdController)
);

// PATCH /api/households/:id/settings — Update household settings (admin/owner only)
router.patch(
  '/:id/settings',
  authMiddleware,
  emailVerifiedMiddleware,
  updateSettingsValidation,
  handleValidationErrors,
  householdController.updateSettings.bind(householdController)
);

// PATCH /api/households/:id/members/me/income — Update own monthly income
router.patch(
  '/:id/members/me/income',
  authMiddleware,
  emailVerifiedMiddleware,
  updateMemberIncomeValidation,
  handleValidationErrors,
  householdController.updateMemberIncome.bind(householdController)
);

// POST /api/households/:id/settlements
router.post(
  '/:id/settlements',
  authMiddleware,
  emailVerifiedMiddleware,
  recordSettlementValidation,
  handleValidationErrors,
  householdController.recordSettlement.bind(householdController)
);

router.use('/:id/expenses', expenseRouter);
router.use('/:id/recurring-expenses', recurringExpenseRouter);
router.use('/:id/tasks', taskRouter);
router.use('/:id/recurring-tasks', recurringTaskRouter);
router.use('/:id/goals', goalRouter);
router.use('/:id/joint-account', jointAccountRouter);

export default router;
