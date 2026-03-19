import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { goalService } from '../services/goal.service';
import { IAddGoalInput, IUpdateGoalInput, IAddContributionInput, GoalStatus } from '../types/goal.types';

class GoalController {
  // POST /api/households/:id/goals
  async addGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input = req.body as IAddGoalInput;

      const goal = await goalService.addGoal(householdId, req.user.userId, input);

      res.status(201).json({ status: 'success', data: { goal } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/goals
  async listGoals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const status = req.query.status as GoalStatus | undefined;

      const goals = await goalService.listGoals(householdId, req.user.userId, status);

      res.status(200).json({ status: 'success', data: { goals } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/goals/:goalId
  async getGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const goalId = req.params.goalId as string;

      const goal = await goalService.getGoal(householdId, req.user.userId, goalId);

      res.status(200).json({ status: 'success', data: { goal } });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/goals/:goalId
  async updateGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const goalId = req.params.goalId as string;
      const input = req.body as IUpdateGoalInput;

      const goal = await goalService.updateGoal(householdId, req.user.userId, goalId, input);

      res.status(200).json({ status: 'success', data: { goal } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/goals/:goalId
  async deleteGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const goalId = req.params.goalId as string;

      await goalService.deleteGoal(householdId, req.user.userId, goalId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/goals/:goalId/contributions
  async addContribution(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const goalId = req.params.goalId as string;
      const input = req.body as IAddContributionInput;

      const goal = await goalService.addContribution(householdId, req.user.userId, goalId, input);

      res.status(201).json({ status: 'success', data: { goal } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/goals/:goalId/contributions/:contributionId
  async removeContribution(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const goalId = req.params.goalId as string;
      const contributionId = req.params.contributionId as string;

      const goal = await goalService.removeContribution(
        householdId,
        req.user.userId,
        goalId,
        contributionId
      );

      res.status(200).json({ status: 'success', data: { goal } });
    } catch (error) {
      next(error);
    }
  }
}

export const goalController = new GoalController();
