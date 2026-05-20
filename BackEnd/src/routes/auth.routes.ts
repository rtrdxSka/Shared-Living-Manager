import { Router, type RequestHandler } from 'express';
import rateLimit, { type Options as RateLimitOptions } from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';

// In NODE_ENV=test the strict auth rate-limiters (3/hour, 10/minute) cause
// E2E flakiness: a single test that makes a handful of refresh calls can
// exhaust the budget and break every later test in the run. Skip the limiter
// entirely in test mode — production behaviour is unaffected.
const limiter = (config: Partial<RateLimitOptions>): RequestHandler =>
  process.env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : rateLimit(config);
import {
  loginValidation,
  refreshTokenValidation,
  registerValidation,
  verifyEmailValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../validators/auth.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Dedicated rate limiter for forgot password (3 req / 15 min)
const forgotPasswordLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    status: 'error',
    message: 'Too many password reset requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Dedicated rate limiter for resend verification (3 req / 60 min)
const resendVerificationLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    status: 'error',
    message: 'Too many verification email requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Dedicated rate limiter for refresh token rotation (10 req / min per IP).
// Prevents brute-force enumeration of valid refresh tokens.
const refreshLimiter = limiter({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    status: 'error',
    message: 'Too many refresh attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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
  refreshLimiter,
  refreshTokenValidation,
  handleValidationErrors,
  authController.refresh.bind(authController)
);

router.post(
  '/verify-email',
  verifyEmailValidation,
  handleValidationErrors,
  authController.verifyEmail.bind(authController)
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordValidation,
  handleValidationErrors,
  authController.forgotPassword.bind(authController)
);

router.post(
  '/reset-password',
  resetPasswordValidation,
  handleValidationErrors,
  authController.resetPassword.bind(authController)
);

// Protected routes
router.post('/logout', authMiddleware, authController.logout.bind(authController));

router.get('/me', authMiddleware, authController.getMe.bind(authController));

router.post(
  '/resend-verification',
  authMiddleware,
  resendVerificationLimiter,
  authController.resendVerification.bind(authController)
);

export default router;
