import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { updateProfileValidation, changePasswordValidation } from '../validators/user.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.patch(
  '/profile',
  authMiddleware,
  emailVerifiedMiddleware,
  updateProfileValidation,
  handleValidationErrors,
  userController.updateProfile.bind(userController)
);

router.patch(
  '/password',
  authMiddleware,
  emailVerifiedMiddleware,
  changePasswordValidation,
  handleValidationErrors,
  userController.changePassword.bind(userController)
);

export default router;
