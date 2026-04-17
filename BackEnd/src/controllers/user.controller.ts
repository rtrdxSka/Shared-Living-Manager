import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { userService } from '../services/user.service';
import { IUpdateProfileInput, IChangePasswordInput } from '../types/user.types';

class UserController {
  // PATCH /api/users/profile
  async updateProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const input: IUpdateProfileInput = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        currentPassword: req.body.currentPassword,
      };

      const result = await userService.updateProfile(req.user.userId, input);

      res.status(200).json({
        status: 'success',
        data: { user: result.user },
        ...(result.emailChanged && {
          message: 'Profile updated. A verification email has been sent to your new email address.',
        }),
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/users/password
  async changePassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const input: IChangePasswordInput = {
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
      };

      await userService.changePassword(req.user.userId, input);

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
