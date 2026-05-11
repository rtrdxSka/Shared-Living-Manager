import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { householdService } from '../services/household.service';
import { ICreateHouseholdInput, IJoinHouseholdInput, IUpdateHouseholdSettingsInput } from '../types/household.types';

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

  // PATCH /api/households/:id/settings
  async updateSettings(
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
      const input = req.body as IUpdateHouseholdSettingsInput;

      const household = await householdService.updateSettings(
        householdId,
        req.user.userId,
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

  // POST /api/households/:id/settlements
  async recordSettlement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ status: 'error', message: 'Unauthorized' }); return; }
      const { month, amount } = req.body as { month: string; amount: number };
      const household = await householdService.recordSettlement(req.params.id as string, req.user.userId, month, amount);
      res.status(201).json({ status: 'success', data: { household } });
    } catch (error) { next(error); }
  }

  // PATCH /api/households/:id/invite-code
  async regenerateInviteCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ status: 'error', message: 'Unauthorized' }); return; }
      const household = await householdService.regenerateInviteCode(req.params.id as string, req.user.userId);
      res.status(200).json({ status: 'success', data: { household } });
    } catch (error) { next(error); }
  }

  // POST /api/households/:id/invite/email
  async sendInviteEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const { recipientEmail, personalNote } = req.body as {
        recipientEmail: string;
        personalNote?: string;
      };
      await householdService.sendInviteEmail(
        req.params.id as string,
        req.user.userId,
        recipientEmail,
        personalNote
      );
      res.status(202).json({ status: 'success', data: { ok: true } });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/members/me/income
  async updateMemberIncome(
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
      const { monthlyIncome } = req.body as { monthlyIncome: number };

      const household = await householdService.updateMemberIncome(
        householdId,
        req.user.userId,
        monthlyIncome
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
