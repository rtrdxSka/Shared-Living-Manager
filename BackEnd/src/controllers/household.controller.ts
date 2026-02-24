import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { householdService } from '../services/household.service';
import { ICreateHouseholdInput, IJoinHouseholdInput } from '../types/household.types';

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

  // POST /api/households/join
  async join(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const input: IJoinHouseholdInput = { inviteCode: req.body.inviteCode };

      const household = await householdService.joinHousehold(
        req.user.userId,
        req.user.email,
        input
      );

      res.status(200).json({
        status: 'success',
        data: { household },
      });
    } catch (error) {
      next(error);
    }
  }
  // GET /api/households/:id
  async getById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;

      const household = await householdService.getById(
        householdId,
        req.user.userId
      );

      res.status(200).json({
        status: 'success',
        data: { household },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const householdController = new HouseholdController();
