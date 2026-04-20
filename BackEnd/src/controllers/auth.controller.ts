import { Response, NextFunction, CookieOptions } from 'express';

import { AuthRequest } from '../middleware/auth';
import { authService } from '../services/auth.service';
import { ILoginInput, IRegisterInput } from '../types/user.types';

const REFRESH_COOKIE: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — matches JWT refresh token expiry
  path: '/api/auth',
};

class AuthController {
  // POST /api/auth/register
  async register(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input: IRegisterInput = {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
      };

      const result = await authService.register(input);

      res.cookie('refreshToken', result.tokens.refreshToken, REFRESH_COOKIE);
      res.status(201).json({
        status: 'success',
        data: {
          user: result.user,
          tokens: { accessToken: result.tokens.accessToken },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/login
  async login(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input: ILoginInput = {
        email: req.body.email,
        password: req.body.password,
      };

      const result = await authService.login(input);

      res.cookie('refreshToken', result.tokens.refreshToken, REFRESH_COOKIE);
      res.status(200).json({
        status: 'success',
        data: {
          user: result.user,
          tokens: { accessToken: result.tokens.accessToken },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/refresh
  async refresh(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken as string | undefined;
      if (!refreshToken) {
        res.status(401).json({ status: 'error', message: 'No refresh token' });
        return;
      }

      const tokens = await authService.refreshToken(refreshToken);

      // Rotate refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE);
      res.status(200).json({
        status: 'success',
        data: { tokens: { accessToken: tokens.accessToken } },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/logout
  async logout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      await authService.logout(req.user.userId);

      res.clearCookie('refreshToken', { path: '/api/auth' });
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/me
  async getMe(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const user = await authService.getMe(req.user.userId);

      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }
  // POST /api/auth/verify-email
  async verifyEmail(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.verifyEmail(req.body.token);

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/resend-verification
  async resendVerification(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      await authService.resendVerificationEmail(req.user.userId);

      res.status(200).json({
        status: 'success',
        message: 'Verification email sent',
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/forgot-password
  async forgotPassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.forgotPassword(req.body.email);

      // Always return same response regardless of email existence
      res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/reset-password
  async resetPassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.resetPassword(req.body.token, req.body.password);

      res.status(200).json({
        status: 'success',
        message: 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();