import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { householdService } from '../services/household.service';
import { ICreateHouseholdInput } from '../types/household.types';

class HouseholdController {
  // POST /api/households
  async create(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const input: ICreateHouseholdInput = req.body;

      const household = await householdService.createFromOnboarding(
        req.user.userId,
        input
      );

      res.status(201).json({
        status: 'success',
        data: { household },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const householdController = new HouseholdController();
