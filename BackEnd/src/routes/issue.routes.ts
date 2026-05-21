import { Router } from 'express';
import { issueController } from '../controllers/issue.controller';
import {
  listIssuesValidation,
  createIssueValidation,
  issueIdValidation,
  commentValidation,
  commentIdValidation,
  escalateValidation,
} from '../validators/issue.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// IMPORTANT: keep any static sub-routes BEFORE :issueId catchall — Express matches in order.
// (No static routes here, but be alert when wiring future ones.)

// GET /api/households/:id/issues
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  listIssuesValidation,
  handleValidationErrors,
  issueController.listIssues.bind(issueController)
);

// POST /api/households/:id/issues
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  createIssueValidation,
  handleValidationErrors,
  issueController.createIssue.bind(issueController)
);

// GET /api/households/:id/issues/:issueId
router.get(
  '/:issueId',
  authMiddleware,
  emailVerifiedMiddleware,
  issueIdValidation,
  handleValidationErrors,
  issueController.getIssue.bind(issueController)
);

// DELETE /api/households/:id/issues/:issueId
router.delete(
  '/:issueId',
  authMiddleware,
  emailVerifiedMiddleware,
  issueIdValidation,
  handleValidationErrors,
  issueController.deleteIssue.bind(issueController)
);

// POST /api/households/:id/issues/:issueId/upvote
router.post(
  '/:issueId/upvote',
  authMiddleware,
  emailVerifiedMiddleware,
  issueIdValidation,
  handleValidationErrors,
  issueController.toggleUpvote.bind(issueController)
);

// POST /api/households/:id/issues/:issueId/comments
router.post(
  '/:issueId/comments',
  authMiddleware,
  emailVerifiedMiddleware,
  commentValidation,
  handleValidationErrors,
  issueController.addComment.bind(issueController)
);

// DELETE /api/households/:id/issues/:issueId/comments/:commentId
router.delete(
  '/:issueId/comments/:commentId',
  authMiddleware,
  emailVerifiedMiddleware,
  commentIdValidation,
  handleValidationErrors,
  issueController.deleteComment.bind(issueController)
);

// POST /api/households/:id/issues/:issueId/escalate
router.post(
  '/:issueId/escalate',
  authMiddleware,
  emailVerifiedMiddleware,
  escalateValidation,
  handleValidationErrors,
  issueController.escalate.bind(issueController)
);

// GET /api/households/:id/issues/:issueId/moderation
router.get(
  '/:issueId/moderation',
  authMiddleware,
  emailVerifiedMiddleware,
  issueIdValidation,
  handleValidationErrors,
  issueController.getModeration.bind(issueController)
);

export default router;
