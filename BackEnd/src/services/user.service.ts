import { User } from '../models/user.model';
import {
  IUpdateProfileInput,
  IChangePasswordInput,
  IUserResponse,
  IUser,
} from '../types/user.types';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/error';
import { generateToken, hashToken } from '../utils/token';
import { sendVerificationEmail } from '../utils/email';

class UserService {
  // ── Update Profile ────────────────────────────────────────────────
  async updateProfile(
    userId: string,
    input: IUpdateProfileInput
  ): Promise<{ user: IUserResponse; emailChanged: boolean }> {
    const user = await User.findById(userId);
    if (!user) {
      throw NotFoundError('User not found');
    }

    let emailChanged = false;

    if (input.firstName !== undefined) {
      user.firstName = input.firstName;
    }

    if (input.lastName !== undefined) {
      user.lastName = input.lastName;
    }

    if (input.email !== undefined && input.email !== user.email) {
      // Check uniqueness
      const existingUser = await User.findOne({ email: input.email });
      if (existingUser) {
        throw ConflictError('A user with this email already exists');
      }

      user.email = input.email;
      user.isEmailVerified = false;
      emailChanged = true;

      // Generate and send new verification email
      const verificationToken = generateToken();
      user.emailVerificationToken = hashToken(verificationToken);
      user.emailVerificationExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Fire-and-forget
      sendVerificationEmail(input.email, user.firstName, verificationToken).catch(() => {});
    }

    await user.save();

    return {
      user: this.formatUserResponse(user),
      emailChanged,
    };
  }

  // ── Change Password ───────────────────────────────────────────────
  async changePassword(
    userId: string,
    input: IChangePasswordInput
  ): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw NotFoundError('User not found');
    }

    const isCurrentValid = await user.comparePassword(input.currentPassword);
    if (!isCurrentValid) {
      throw UnauthorizedError('Current password is incorrect');
    }

    user.password = input.newPassword; // pre-save hook hashes
    await user.save();
  }

  // ── Private helpers ───────────────────────────────────────────────

  private formatUserResponse(user: IUser): IUserResponse {
    return {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      households: user.households.map((id) => id.toString()),
      activeHousehold: user.activeHousehold?.toString(),
      preferences: user.preferences,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }
}

export const userService = new UserService();
