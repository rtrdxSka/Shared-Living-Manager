import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recurringTaskService } from '../services/recurring-task.service';
import { ICreateRecurringTaskInput, IUpdateRecurringTaskInput } from '../types/recurring-task.types';

class RecurringTaskController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const input = req.body as ICreateRecurringTaskInput;
      const template = await recurringTaskService.create(householdId, req.user.userId, input);
      res.status(201).json({ status: 'success', data: { recurringTask: template } });
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const templates = await recurringTaskService.list(householdId, req.user.userId);
      res.status(200).json({ status: 'success', data: { items: templates } });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const recurringTaskId = req.params.recurringTaskId as string;
      const input = req.body as IUpdateRecurringTaskInput;
      const template = await recurringTaskService.update(householdId, req.user.userId, recurringTaskId, input);
      res.status(200).json({ status: 'success', data: { recurringTask: template } });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const householdId = req.params.id as string;
      const recurringTaskId = req.params.recurringTaskId as string;
      await recurringTaskService.deactivate(householdId, req.user.userId, recurringTaskId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const recurringTaskController = new RecurringTaskController();
