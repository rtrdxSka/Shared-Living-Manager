import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LRUCache } from 'lru-cache';
import { IJwtPayload } from '../types/user.types';
import { ForbiddenError, UnauthorizedError } from '../utils/error';
import { User } from '../models/user.model';


// ── Extend Express Request ────────────────────────────────────────────
export interface AuthRequest extends Request {
  user?: IJwtPayload;
}

// ── Email-verified status cache ───────────────────────────────────────
// Short-TTL cache to avoid hitting the DB on every authenticated request.
// Entries auto-expire after 5 minutes; no explicit invalidation on verify
// is needed at this TTL (users see at most a 5-minute stale block).
const verifiedCache = new LRUCache<string, boolean>({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
});

// ── Auth middleware ───────────────────────────────────────────────────
export const authMiddleware = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw UnauthorizedError('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw UnauthorizedError('Access token is required');
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as IJwtPayload;

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(UnauthorizedError('Access token has expired'));
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      next(UnauthorizedError('Invalid access token'));
      return;
    }
    next(error);
  }
};

// ── Email verified middleware ─────────────────────────────────────────
// Must be placed AFTER authMiddleware so req.user is populated.
export const emailVerifiedMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw UnauthorizedError('Access token is required');
    }

    const userId = req.user.userId;

    // Fast path: cache hit
    const cached = verifiedCache.get(userId);
    if (cached === true) {
      next();
      return;
    }
    if (cached === false) {
      throw ForbiddenError('Please verify your email address before accessing this resource');
    }

    // Cache miss: hit the DB and cache the result
    const user = await User.findById(userId).select('isEmailVerified').lean();
    if (!user) {
      throw UnauthorizedError('User not found');
    }

    const isVerified = Boolean(user.isEmailVerified);
    verifiedCache.set(userId, isVerified);

    if (!isVerified) {
      throw ForbiddenError('Please verify your email address before accessing this resource');
    }

    next();
  } catch (error) {
    next(error);
  }
};
