import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { houseRuleService } from '../services/house-rule.service';

class HouseRuleController {
  // GET /api/households/:id/house-rules
  async list(
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
      const result = await houseRuleService.listRules(
        householdId,
        req.user.userId,
        { includeArchived: req.query.includeArchived === 'true' }
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/house-rules/:ruleId/archive
  async archive(
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
      const ruleId = req.params.ruleId as string;
      const rule = await houseRuleService.archiveRule(
        householdId,
        req.user.userId,
        ruleId
      );
      res.status(200).json({ status: 'success', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/house-rules/:ruleId/restore
  async restore(
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
      const ruleId = req.params.ruleId as string;
      const rule = await houseRuleService.restoreRule(
        householdId,
        req.user.userId,
        ruleId
      );
      res.status(200).json({ status: 'success', data: { rule } });
    } catch (error) {
      next(error);
    }
  }
}

export const houseRuleController = new HouseRuleController();
