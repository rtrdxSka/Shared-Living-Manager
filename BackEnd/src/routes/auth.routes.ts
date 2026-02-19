import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { loginValidation, refreshTokenValidation, registerValidation } from '../validators/auth.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';



const router = Router();

// Public routes
router.post(
  '/register',
  registerValidation,
  handleValidationErrors,
  authController.register.bind(authController)
);

router.post(
  '/login',
  loginValidation,
  handleValidationErrors,
  authController.login.bind(authController)
);

router.post(
  '/refresh',
  refreshTokenValidation,
  handleValidationErrors,
  authController.refresh.bind(authController)
);

// Protected routes
router.post('/logout', authMiddleware, authController.logout.bind(authController));

router.get('/me', authMiddleware, authController.getMe.bind(authController));

export default router;