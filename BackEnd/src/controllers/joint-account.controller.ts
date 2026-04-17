import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { jointAccountService } from '../services/joint-account.service';
import { IAddTransactionInput, IUpdateJointAccountConfigInput } from '../types/joint-account.types';

class JointAccountController {
  // GET /api/households/:id/joint-account
  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const month = req.query.month as string | undefined;
      const paginationInput = {
        page: req.query.page as unknown as number | undefined,
        limit: req.query.limit as unknown as number | undefined,
      };

      const summary = await jointAccountService.getSummary(
        householdId,
        req.user.userId,
        month,
        paginationInput
      );

      res.status(200).json({ status: 'success', data: { summary } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/joint-account/transactions
  async addTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input = req.body as IAddTransactionInput;

      const transaction = await jointAccountService.addTransaction(
        householdId,
        req.user.userId,
        input
      );

      res.status(201).json({ status: 'success', data: { transaction } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/joint-account/transactions/:txId
  async deleteTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const txId = req.params.txId as string;

      await jointAccountService.deleteTransaction(
        householdId,
        req.user.userId,
        txId
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/joint-account/config
  async updateConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input = req.body as IUpdateJointAccountConfigInput;

      const household = await jointAccountService.updateConfig(
        householdId,
        req.user.userId,
        input
      );

      res.status(200).json({ status: 'success', data: { household } });
    } catch (error) {
      next(error);
    }
  }
}

export const jointAccountController = new JointAccountController();
