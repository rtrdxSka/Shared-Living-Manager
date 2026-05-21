import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { voteService } from '../services/vote.service';

class VoteController {
  // GET /api/households/:id/votes
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
      const result = await voteService.listVotes(
        householdId,
        req.user.userId,
        { status: req.query.status as string | undefined }
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/votes
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
      const householdId = req.params.id as string;
      const created = await voteService.createVote(
        householdId,
        req.user.userId,
        req.body
      );
      const vote = await voteService.getVote(
        householdId,
        req.user.userId,
        created._id.toString()
      );
      res.status(201).json({ status: 'success', data: { vote } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/votes/:voteId
  async get(
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
      const voteId = req.params.voteId as string;
      const vote = await voteService.getVote(
        householdId,
        req.user.userId,
        voteId
      );
      res.status(200).json({ status: 'success', data: { vote } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/votes/:voteId/ballot
  async castBallot(
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
      const voteId = req.params.voteId as string;
      const vote = await voteService.castBallot(
        householdId,
        req.user.userId,
        voteId,
        req.body.choice
      );
      res.status(200).json({ status: 'success', data: { vote } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/votes/:voteId/close
  async close(
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
      const voteId = req.params.voteId as string;
      const closed = await voteService.closeVoteEarly(
        householdId,
        req.user.userId,
        voteId
      );
      const vote = await voteService.getVote(
        householdId,
        req.user.userId,
        closed._id.toString()
      );
      res.status(200).json({ status: 'success', data: { vote } });
    } catch (error) {
      next(error);
    }
  }
}

export const voteController = new VoteController();
