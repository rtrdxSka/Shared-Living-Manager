import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { shoppingListService } from '../services/shopping-list.service';
import { IAddShoppingItemInput } from '../types/shopping-list.types';

class ShoppingListController {
  // POST /api/households/:id/shopping-list
  async addItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input = req.body as IAddShoppingItemInput;

      const item = await shoppingListService.addItem(householdId, req.user.userId, input);

      res.status(201).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/shopping-list
  async listItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const result = await shoppingListService.listItems(householdId, req.user.userId);

      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/shopping-list/:itemId/bought
  async toggleBought(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;

      const item = await shoppingListService.toggleBought(householdId, req.user.userId, itemId);

      res.status(200).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/shopping-list/:itemId
  async deleteItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;

      await shoppingListService.deleteItem(householdId, req.user.userId, itemId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/shopping-list/clear-bought
  async clearBought(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const result = await shoppingListService.clearBought(householdId, req.user.userId);

      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const shoppingListController = new ShoppingListController();
