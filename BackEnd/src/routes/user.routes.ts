import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { updateProfileValidation, changePasswordValidation } from '../validators/user.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.patch(
  '/profile',
  authMiddleware,
  updateProfileValidation,
  handleValidationErrors,
  userController.updateProfile.bind(userController)
);

router.patch(
  '/password',
  authMiddleware,
  changePasswordValidation,
  handleValidationErrors,
  userController.changePassword.bind(userController)
);

export default router;
