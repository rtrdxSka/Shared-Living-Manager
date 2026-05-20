import { Router, Request, Response, NextFunction } from 'express';
import { query, body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validate';
import { testUtilityService } from '../services/__test__.service';

/**
 * Test-only routes. Mounted in `src/index.ts` only when NODE_ENV === 'test',
 * so this router is physically unreachable in production builds.
 */
const router = Router();

// POST /api/__test__/reset — Drop all collections in the test DB.
router.post('/reset', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await testUtilityService.resetDatabase();
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

// GET /api/__test__/last-token?email=&type=verify|reset
router.get(
  '/last-token',
  [query('email').isEmail(), query('type').isIn(['verify', 'reset'])],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.query.email as string;
      const type = req.query.type as 'verify' | 'reset';
      const token = await testUtilityService.getLastToken(email, type);
      res.status(200).json({ token });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/__test__/email-status?email=
router.get(
  '/email-status',
  [query('email').isEmail()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await testUtilityService.getEmailStatus(req.query.email as string);
      res.status(200).json(status);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/__test__/fast-forward-rotation { householdId, daysBack }
router.post(
  '/fast-forward-rotation',
  [body('householdId').isMongoId(), body('daysBack').isInt({ min: 1, max: 365 })],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await testUtilityService.fastForwardRotation(req.body.householdId, req.body.daysBack);
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
