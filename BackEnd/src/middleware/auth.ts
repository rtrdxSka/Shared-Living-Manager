import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IJwtPayload } from '../types/user.types';
import { ForbiddenError, UnauthorizedError } from '../utils/error';
import { User } from '../models/user.model';


// ── Extend Express Request ────────────────────────────────────────────
export interface AuthRequest extends Request {
  user?: IJwtPayload;
}

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

    const user = await User.findById(req.user.userId).select('isEmailVerified');
    if (!user) {
      throw UnauthorizedError('User not found');
    }

    if (!user.isEmailVerified) {
      throw ForbiddenError('Please verify your email address before accessing this resource');
    }

    next();
  } catch (error) {
    next(error);
  }
};