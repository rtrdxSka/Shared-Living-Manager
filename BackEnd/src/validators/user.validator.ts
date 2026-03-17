import { body, ValidationChain } from 'express-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

// ── Update profile validation ────────────────────────────────────────
export const updateProfileValidation: ValidationChain[] = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail({ gmail_remove_subaddress: false }),

  body('currentPassword')
    .optional()
    .isString()
    .withMessage('Current password must be a string'),
];

// ── Change password validation ───────────────────────────────────────
export const changePasswordValidation: ValidationChain[] = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one digit'
    ),
];
