import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { householdController } from '../controllers/household.controller';
import { createHouseholdValidation, joinHouseholdValidation, getHouseholdByIdValidation, updateSettingsValidation, updateMemberIncomeValidation, recordSettlementValidation, regenerateInviteCodeValidation, sendInviteEmailValidation } from '../validators/household.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';
import expenseRouter from './expense.routes';
import recurringExpenseRouter from './recurring-expense.routes';
import taskRouter from './task.routes';
import shoppingListRouter from './shopping-list.routes';
import recurringTaskRouter from './recurring-task.routes';
import goalRouter from './goal.routes';
import jointAccountRouter from './joint-account.routes';

const router = Router();

// Dedicated rate limiter for household join attempts (5 req / min per IP).
// Prevents brute-force enumeration of valid invite codes.
const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    status: 'error',
    message: 'Too many join attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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
  joinLimiter,
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

// PATCH /api/households/:id/invite-code — Regenerate invite code (admin/owner only)
router.patch(
  '/:id/invite-code',
  authMiddleware,
  emailVerifiedMiddleware,
  regenerateInviteCodeValidation,
  handleValidationErrors,
  householdController.regenerateInviteCode.bind(householdController)
);

// POST /api/households/:id/invite/email — Send invitation email (admin/owner only)
router.post(
  '/:id/invite/email',
  authMiddleware,
  emailVerifiedMiddleware,
  sendInviteEmailValidation,
  handleValidationErrors,
  householdController.sendInviteEmail.bind(householdController)
);

router.use('/:id/expenses', expenseRouter);
router.use('/:id/recurring-expenses', recurringExpenseRouter);
router.use('/:id/tasks', taskRouter);
router.use('/:id/shopping-list', shoppingListRouter);
router.use('/:id/recurring-tasks', recurringTaskRouter);
router.use('/:id/goals', goalRouter);
router.use('/:id/joint-account', jointAccountRouter);

export default router;
