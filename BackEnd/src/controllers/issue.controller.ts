import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { issueService } from '../services/issue.service';

class IssueController {
  // GET /api/households/:id/issues
  async listIssues(
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
      const result = await issueService.listIssues(
        householdId,
        req.user.userId,
        {
          status: req.query.status as string | undefined,
          category: req.query.category as string | undefined,
          cursor: req.query.cursor as string | undefined,
          limit: req.query.limit
            ? parseInt(req.query.limit as string, 10)
            : undefined,
        }
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/issues
  async createIssue(
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
      const issue = await issueService.createIssue(
        householdId,
        req.user.userId,
        req.body
      );
      res.status(201).json({ status: 'success', data: { issue } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/issues/:issueId
  async getIssue(
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
      const issueId = req.params.issueId as string;
      const issue = await issueService.getIssue(
        householdId,
        req.user.userId,
        issueId
      );
      res.status(200).json({ status: 'success', data: { issue } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/issues/:issueId
  async deleteIssue(
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
      const issueId = req.params.issueId as string;
      await issueService.deleteIssue(
        householdId,
        req.user.userId,
        issueId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/issues/:issueId/upvote
  async toggleUpvote(
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
      const issueId = req.params.issueId as string;
      const result = await issueService.toggleUpvote(
        householdId,
        req.user.userId,
        issueId
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/issues/:issueId/comments
  async addComment(
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
      const issueId = req.params.issueId as string;
      const comment = await issueService.addComment(
        householdId,
        req.user.userId,
        issueId,
        req.body.body as string
      );
      res.status(201).json({ status: 'success', data: { comment } });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/households/:id/issues/:issueId/comments/:commentId
  async deleteComment(
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
      const commentId = req.params.commentId as string;
      await issueService.deleteComment(
        householdId,
        req.user.userId,
        commentId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/issues/:issueId/escalate
  async escalate(
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
      const issueId = req.params.issueId as string;
      const vote = await issueService.escalateToVote(
        householdId,
        req.user.userId,
        issueId,
        req.body
      );
      // Escalation transitions an issue to status='escalated' AND creates a Vote.
      // We respond 200 because the primary action is mutating the existing issue,
      // and only return the Vote id so the client can navigate to the new poll.
      res.status(200).json({
        status: 'success',
        data: { vote: { _id: vote._id.toString() } },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/issues/:issueId/moderation
  async getModeration(
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
      const issueId = req.params.issueId as string;
      const issue = await issueService.getIssueForModeration(
        householdId,
        req.user.userId,
        issueId
      );
      res.status(200).json({ status: 'success', data: { issue } });
    } catch (error) {
      next(error);
    }
  }
}

export const issueController = new IssueController();
