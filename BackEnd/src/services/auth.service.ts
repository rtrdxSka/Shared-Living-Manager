import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/user.model';
import { RefreshToken } from '../models/refresh-token.model';
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

interface IAuthOpts {
  userAgent?: string;
}

interface ILogoutOpts {
  rawToken?: string;
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

class AuthService {
  // ── Register ──────────────────────────────────────────────────────
  async register(input: IRegisterInput, opts?: IAuthOpts): Promise<IAuthResponse> {
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
    const tokens = await this.generateAndStoreTokens(user, opts);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  // ── Login ─────────────────────────────────────────────────────────
  async login(input: ILoginInput, opts?: IAuthOpts): Promise<IAuthResponse> {
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
    const tokens = await this.generateAndStoreTokens(user, opts);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  // ── Refresh Token ─────────────────────────────────────────────────
  async refreshToken(rawToken: string): Promise<IAuthTokens> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw UnauthorizedError('Invalid or expired refresh token');
    }

    const doc = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
    if (!doc) {
      throw UnauthorizedError('Invalid or expired refresh token');
    }
    if (doc.revokedAt) {
      throw UnauthorizedError('Invalid or expired refresh token');
    }
    if (doc.expiresAt.getTime() < Date.now()) {
      throw UnauthorizedError('Invalid or expired refresh token');
    }
    if (doc.replacedBy) {
      // THEFT DETECTED — an already-rotated token is being re-used.
      // Panic response: revoke ALL active refresh tokens for this user.
      await RefreshToken.updateMany(
        { userId: doc.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      throw UnauthorizedError('Refresh token reuse detected — all sessions invalidated');
    }

    // Look up user (need IUser for access-token claims), then mint new pair
    const user = await User.findById(doc.userId);
    if (!user) {
      throw UnauthorizedError('Invalid or expired refresh token');
    }

    const tokens = await this.generateAndStoreTokens(user, { userAgent: doc.userAgent });

    // Mark old as replaced (chain forward). Find the new RT doc by hash to get its _id.
    const newDoc = await RefreshToken.findOne({ tokenHash: hashToken(tokens.refreshToken) });
    if (newDoc) {
      doc.replacedBy = newDoc._id;
      await doc.save();
    }

    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────
  // Note: Only the refresh token is revoked. The current access token (15-min TTL)
  // remains valid until expiry. This is an accepted trade-off — a token blacklist
  // would require a cache lookup on every authenticated request.
  async logout(userId: string, opts?: ILogoutOpts): Promise<void> {
    if (opts?.rawToken) {
      // Revoke just this device's refresh token. Use updateOne because the token
      // may already be replaced (in which case we still set revokedAt for clarity).
      await RefreshToken.updateOne(
        { tokenHash: hashToken(opts.rawToken) },
        { $set: { revokedAt: new Date() } },
      );
      return;
    }
    // Fallback: revoke every active session for this user.
    await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
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
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw BadRequestError('Invalid or expired reset token');
    }

    user.password = newPassword; // pre-save hook hashes
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Revoke every active refresh token so no new access tokens can be issued
    // from old sessions. Existing access tokens (up to 15-min TTL) remain valid
    // — accepted trade-off.
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
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

  private async generateAndStoreTokens(
    user: IUser,
    opts?: IAuthOpts,
  ): Promise<IAuthTokens> {
    const payload: IJwtPayload = {
      userId: user._id.toString(),
      email: user.email,
    };

    const accessToken = jwt.sign(payload, this.getAccessSecret(), {
      expiresIn: '15m',
    });

    // Mint an opaque high-entropy refresh token (64-char hex). Store its
    // SHA-256 hash so a DB leak doesn't yield usable tokens. SHA-256 is the
    // appropriate choice here (NOT bcrypt) because the token already has
    // 256 bits of entropy — bcrypt's slow-hash is for low-entropy secrets,
    // and silently truncates inputs >72 bytes (the very bug this refactor
    // fixes).
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent: opts?.userAgent,
      // replacedBy / revokedAt: null on initial issue (defaults handle it)
    });

    return { accessToken, refreshToken: rawRefreshToken };
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
}

export const authService = new AuthService();
