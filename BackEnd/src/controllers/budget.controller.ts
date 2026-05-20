import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { budgetService } from '../services/budget.service';
import { BudgetUpdateRequest } from '../types/budget.types';

class BudgetController {
  // GET /api/households/:id/budget
  async getBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const budget = await budgetService.getCurrent(householdId, req.user.userId);
      res.status(200).json({ status: 'success', data: { budget } });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/households/:id/budget
  async updateBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const input = req.body as BudgetUpdateRequest;
      const budget = await budgetService.update(householdId, req.user.userId, input);
      res.status(200).json({ status: 'success', data: { budget } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/budget/snapshot?month=YYYY-MM
  async getSnapshot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const month = req.query.month as string;
      const result = await budgetService.getForMonth(householdId, req.user.userId, month);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/budget/insights?month=YYYY-MM
  async getInsights(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const month = req.query.month as string;
      const insights = await budgetService.getInsights(householdId, req.user.userId, month);
      res.status(200).json({ status: 'success', data: insights });
    } catch (error) {
      next(error);
    }
  }
}

export const budgetController = new BudgetController();
