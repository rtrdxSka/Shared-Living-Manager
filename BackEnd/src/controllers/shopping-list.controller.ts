import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { shoppingListService } from '../services/shopping-list.service';
import {
  IAddShoppingItemInput,
  IUpdateShoppingItemInput,
  IArchiveBoughtInput,
} from '../types/shopping-list.types';

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
      const archived = req.query.archived === 'true';
      const result = await shoppingListService.listItems(householdId, req.user.userId, { archived });
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/shopping-list/:itemId
  async updateItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const input = req.body as IUpdateShoppingItemInput;
      const item = await shoppingListService.updateItem(householdId, req.user.userId, itemId, input);
      res.status(200).json({ status: 'success', data: { item } });
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

  // POST /api/households/:id/shopping-list/:itemId/archive
  async archiveItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const item = await shoppingListService.archiveItem(householdId, req.user.userId, itemId);
      res.status(200).json({ status: 'success', data: { item } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/shopping-list/:itemId/restore
  async restoreItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const itemId = req.params.itemId as string;
      const item = await shoppingListService.restoreItem(householdId, req.user.userId, itemId);
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

  // POST /api/households/:id/shopping-list/archive-bought
  async archiveBought(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const { expenseId, dominantCategory } = req.body as IArchiveBoughtInput;
      const result = await shoppingListService.archiveBought(
        householdId,
        req.user.userId,
        expenseId,
        dominantCategory
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/shopping-list/history
  async listArchivedHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const result = await shoppingListService.listArchivedHistory(
        householdId,
        req.user.userId,
        cursor,
        limit
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const shoppingListController = new ShoppingListController();
