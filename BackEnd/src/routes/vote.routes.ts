import { Router } from 'express';
import { voteController } from '../controllers/vote.controller';
import {
  listVotesValidation,
  createVoteValidation,
  voteIdValidation,
  castBallotValidation,
} from '../validators/vote.validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware, emailVerifiedMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

// IMPORTANT: keep any static sub-routes BEFORE :voteId catchall — Express matches in order.
// (No static routes here, but be alert when wiring future ones.)

// GET /api/households/:id/votes
router.get(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  listVotesValidation,
  handleValidationErrors,
  voteController.list.bind(voteController)
);

// POST /api/households/:id/votes
router.post(
  '/',
  authMiddleware,
  emailVerifiedMiddleware,
  createVoteValidation,
  handleValidationErrors,
  voteController.create.bind(voteController)
);

// GET /api/households/:id/votes/:voteId
router.get(
  '/:voteId',
  authMiddleware,
  emailVerifiedMiddleware,
  voteIdValidation,
  handleValidationErrors,
  voteController.get.bind(voteController)
);

// POST /api/households/:id/votes/:voteId/ballot
router.post(
  '/:voteId/ballot',
  authMiddleware,
  emailVerifiedMiddleware,
  castBallotValidation,
  handleValidationErrors,
  voteController.castBallot.bind(voteController)
);

// POST /api/households/:id/votes/:voteId/close
router.post(
  '/:voteId/close',
  authMiddleware,
  emailVerifiedMiddleware,
  voteIdValidation,
  handleValidationErrors,
  voteController.close.bind(voteController)
);

export default router;
