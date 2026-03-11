import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { taskService } from '../services/task.service';
import { IAddTaskInput, IAssignTaskInput } from '../types/task.types';
import { ISetRotationInput } from '../types/household.types';

class TaskController {
  // POST /api/households/:id/tasks
  async addTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input = req.body as IAddTaskInput;

      const task = await taskService.addTask(householdId, req.user.userId, input);

      res.status(201).json({ status: 'success', data: { task } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/tasks
  async listTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const result = await taskService.listTasks(householdId, req.user.userId);

      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/tasks/:taskId/complete
  async toggleComplete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const taskId = req.params.taskId as string;

      const task = await taskService.toggleComplete(householdId, req.user.userId, taskId);

      res.status(200).json({ status: 'success', data: { task } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/tasks/:taskId
  async deleteTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const taskId = req.params.taskId as string;

      await taskService.deleteTask(householdId, req.user.userId, taskId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/tasks/:taskId/assign
  async assignTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const taskId = req.params.taskId as string;
      const input = req.body as IAssignTaskInput;

      const task = await taskService.assignTask(householdId, req.user.userId, taskId, input);

      res.status(200).json({ status: 'success', data: { task } });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/tasks/rotation
  async setRotation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input = req.body as ISetRotationInput;

      const rotation = await taskService.setRotation(householdId, req.user.userId, input);

      res.status(200).json({ status: 'success', data: { rotation } });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
