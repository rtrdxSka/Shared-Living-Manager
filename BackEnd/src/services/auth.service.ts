import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import {
  IRegisterInput,
  ILoginInput,
  IAuthResponse,
  IAuthTokens,
  IUserResponse,
  IJwtPayload,
  IUser,
} from '../types/user.types';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../utils/error';
import { generateToken, hashToken } from '../utils/token';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';

class AuthService {
  // ── Register ──────────────────────────────────────────────────────
  async register(input: IRegisterInput): Promise<IAuthResponse> {
    const { email, password, firstName, lastName } = input;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ConflictError('A user with this email already exists');
    }

    // Create user (password hashing handled by pre-save hook)
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
    });

    // Generate and store email verification token
    const verificationToken = generateToken();
    user.emailVerificationToken = hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await user.save();

    // Fire-and-forget: registration succeeds even if email fails
    sendVerificationEmail(email, firstName, verificationToken).catch(() => {});

    // Generate tokens
    const tokens = await this.generateAndStoreTokens(user);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  // ── Login ─────────────────────────────────────────────────────────
  async login(input: ILoginInput): Promise<IAuthResponse> {
    const { email, password } = input;

    // Find user with password field included
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateAndStoreTokens(user);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  // ── Refresh Token ─────────────────────────────────────────────────
  async refreshToken(refreshToken: string): Promise<IAuthTokens> {
    // Verify the refresh token
    const secret = this.getRefreshSecret();
    let decoded: IJwtPayload;

    try {
      decoded = jwt.verify(refreshToken, secret, { algorithms: ['HS256'] }) as IJwtPayload;
    } catch {
      throw UnauthorizedError('Invalid or expired refresh token');
    }

    // Find user with stored refresh token
    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || !user.refreshToken) {
      throw UnauthorizedError('Invalid refresh token');
    }

    // Compare provided refresh token with stored hash
    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isTokenValid) {
      // Potential token theft: invalidate all refresh tokens for this user
      user.refreshToken = undefined;
      await user.save();
      throw UnauthorizedError('Invalid refresh token — session invalidated');
    }

    // Token rotation: generate new pair, invalidate old
    const tokens = await this.generateAndStoreTokens(user);
    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────
  // Note: Only the refresh token is revoked. The current access token (15-min TTL)
  // remains valid until expiry. This is an accepted trade-off — a token blacklist
  // would require a cache lookup on every authenticated request.
  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshToken: 1 },
    });
  }

  // ── Verify Email ────────────────────────────────────────────────────
  async verifyEmail(token: string): Promise<void> {
    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      throw BadRequestError('Invalid or expired verification token');
    }

    if (user.isEmailVerified) {
      return;
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw BadRequestError('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
  }

  // ── Resend Verification Email ──────────────────────────────────────
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw NotFoundError('User not found');
    }

    if (user.isEmailVerified) {
      throw BadRequestError('Email is already verified');
    }

    const verificationToken = generateToken();
    user.emailVerificationToken = hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.email, user.firstName, verificationToken);
  }

  // ── Forgot Password ───────────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });

    // Silently return if not found to prevent email enumeration
    if (!user) return;

    const resetToken = generateToken();
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await sendPasswordResetEmail(user.email, user.firstName, resetToken);
  }

  // ── Reset Password ────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +refreshToken');

    if (!user) {
      throw BadRequestError('Invalid or expired reset token');
    }

    user.password = newPassword; // pre-save hook hashes
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Revokes refresh token so no new access tokens can be issued.
    // Existing access tokens (up to 15-min TTL) remain valid — accepted trade-off.
    user.refreshToken = undefined;
    await user.save();
  }

  // ── Get Current User ──────────────────────────────────────────────
  async getMe(userId: string): Promise<IUserResponse> {
    const user = await User.findById(userId);
    if (!user) {
      throw NotFoundError('User not found');
    }

    return this.formatUserResponse(user);
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async generateAndStoreTokens(user: IUser): Promise<IAuthTokens> {
    const payload: IJwtPayload = {
      userId: user._id.toString(),
      email: user.email,
    };

    const accessToken = jwt.sign(payload, this.getAccessSecret(), {
      expiresIn: '15m',
    });

    const refreshToken = jwt.sign(payload, this.getRefreshSecret(), {
      expiresIn: '7d',
    });

    // Store hashed refresh token in DB
    const saltRounds = 10;
    const hashedRefreshToken = await bcrypt.hash(refreshToken, saltRounds);
    user.refreshToken = hashedRefreshToken;
    await user.save();

    return { accessToken, refreshToken };
  }

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

  private getAccessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not defined in environment variables');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    }
    return secret;
  }
}

export const authService = new AuthService();