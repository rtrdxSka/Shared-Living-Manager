import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recurringExpenseService } from '../services/recurring-expense.service';
import { ICreateRecurringExpenseInput, IUpdateRecurringExpenseInput } from '../types/recurring-expense.types';

class RecurringExpenseController {
  // POST /api/households/:id/recurring-expenses
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input = req.body as ICreateRecurringExpenseInput;

      const template = await recurringExpenseService.create(householdId, req.user.userId, input);

      res.status(201).json({ status: 'success', data: { recurringExpense: template } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/recurring-expenses
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;

      const templates = await recurringExpenseService.list(householdId, req.user.userId);

      res.status(200).json({ status: 'success', data: { items: templates } });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/recurring-expenses/:recurringId
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const recurringId = req.params.recurringId as string;
      const input = req.body as IUpdateRecurringExpenseInput;

      const template = await recurringExpenseService.update(householdId, req.user.userId, recurringId, input);

      res.status(200).json({ status: 'success', data: { recurringExpense: template } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/recurring-expenses/:recurringId (soft-delete)
  async deactivate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const recurringId = req.params.recurringId as string;

      await recurringExpenseService.deactivate(householdId, req.user.userId, recurringId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const recurringExpenseController = new RecurringExpenseController();
