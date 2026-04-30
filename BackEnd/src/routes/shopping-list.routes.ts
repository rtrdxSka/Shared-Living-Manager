import { Router } from 'express';
import { shoppingListController } from '../controllers/shopping-list.controller';
import {
  addShoppingItemValidation,
  updateShoppingItemValidation,
  shoppingItemIdValidation,
  householdIdOnlyValidation,
  archiveBoughtValidation,
  historyValidation,
} from '../validators/shopping-list.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

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

// GET /api/households/:id/shopping-list/history — must be before /:itemId routes
router.get(
  '/history',
  authMiddleware,
  emailVerifiedMiddleware,
  historyValidation,
  handleValidationErrors,
  shoppingListController.listArchivedHistory.bind(shoppingListController)
);

// POST /api/households/:id/shopping-list/archive-bought — must be before /:itemId routes
router.post(
  '/archive-bought',
  authMiddleware,
  emailVerifiedMiddleware,
  archiveBoughtValidation,
  handleValidationErrors,
  shoppingListController.archiveBought.bind(shoppingListController)
);

// PATCH /api/households/:id/shopping-list/:itemId
router.patch(
  '/:itemId',
  authMiddleware,
  emailVerifiedMiddleware,
  updateShoppingItemValidation,
  handleValidationErrors,
  shoppingListController.updateItem.bind(shoppingListController)
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

// POST /api/households/:id/shopping-list/:itemId/archive
router.post(
  '/:itemId/archive',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.archiveItem.bind(shoppingListController)
);

// POST /api/households/:id/shopping-list/:itemId/restore
router.post(
  '/:itemId/restore',
  authMiddleware,
  emailVerifiedMiddleware,
  shoppingItemIdValidation,
  handleValidationErrors,
  shoppingListController.restoreItem.bind(shoppingListController)
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
