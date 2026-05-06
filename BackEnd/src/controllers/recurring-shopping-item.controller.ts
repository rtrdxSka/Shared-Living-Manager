import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recurringShoppingItemService } from '../services/recurring-shopping-item.service';
import { IRecurringShoppingItemPayload } from '../types/recurring-shopping-item.types';

class RecurringShoppingItemController {
  // POST /api/households/:id/shopping-list/recurring
  async createRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const payload = req.body as IRecurringShoppingItemPayload;
      const rule = await recurringShoppingItemService.createRule(householdId, req.user.userId, payload);
      res.status(201).json({ status: 'success', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/shopping-list/recurring
  async listRules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const result = await recurringShoppingItemService.listRules(householdId, req.user.userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/shopping-list/recurring/:ruleId
  async updateRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const ruleId = req.params.ruleId as string;
      const payload = req.body as Partial<IRecurringShoppingItemPayload>;
      const rule = await recurringShoppingItemService.updateRule(
        ruleId,
        householdId,
        req.user.userId,
        payload
      );
      res.status(200).json({ status: 'success', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/shopping-list/recurring/:ruleId
  async deleteRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const ruleId = req.params.ruleId as string;
      await recurringShoppingItemService.deleteRule(ruleId, householdId, req.user.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const recurringShoppingItemController = new RecurringShoppingItemController();
