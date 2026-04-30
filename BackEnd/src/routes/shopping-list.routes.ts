import { Router } from 'express';
import { shoppingListController } from '../controllers/shopping-list.controller';
import {
  addShoppingItemValidation,
  shoppingItemIdValidation,
  householdIdOnlyValidation,
} from '../validators/shopping-list.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true }); // exposes :id from household router

// POST /api/households/:id/shopping-list
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  addShoppingItemValidation,
  handleValidationErrors,
  shoppingListController.addItem.bind(shoppingListController)
);

// GET /api/households/:id/shopping-list
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  householdIdOnlyValidation,
  handleValidationErrors,
  shoppingListController.listItems.bind(shoppingListController)
);

// POST /api/households/:id/shopping-list/clear-bought — must come before /:itemId routes
router.post(
  '/clear-bought',
  authMiddleware,
  emailVerifiedMiddleware,
  householdIdOnlyValidation,
  handleValidationErrors,
  shoppingListController.clearBought.bind(shoppingListController)
);

// PATCH /api/households/:id/shopping-list/:itemId/bought
router.patch(
  '/:itemId/bought',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.toggleBought.bind(shoppingListController)
);

// DELETE /api/households/:id/shopping-list/:itemId
router.delete(
  '/:itemId',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.deleteItem.bind(shoppingListController)
);

export default router;
