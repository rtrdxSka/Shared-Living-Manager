import { Document, Types } from 'mongoose';

// ── Notification preferences ──────────────────────────────────────────
export type NotificationFrequency = 'instant' | 'daily' | 'weekly';

export interface INotificationPreferences {
  email: boolean;
  push: boolean;
  frequency: NotificationFrequency;
}

// ── User preferences ──────────────────────────────────────────────────
export interface IUserPreferences {
  language: string;
  currency: string;
  notifications: INotificationPreferences;
}

// ── User document (Mongoose) ──────────────────────────────────────────
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  households: Types.ObjectId[];
  activeHousehold?: Types.ObjectId;
  preferences: IUserPreferences;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ── DTOs ──────────────────────────────────────────────────────────────

export interface IRegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface IUserResponse {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  households: string[];
  activeHousehold?: string;
  preferences: IUserPreferences;
  isEmailVerified: boolean;
  createdAt: Date;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthResponse {
  user: IUserResponse;
  tokens: IAuthTokens;
}

// ── Profile DTOs ─────────────────────────────────────────────────────

export interface IUpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  currentPassword?: string;
}

export interface IChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// ── JWT Payload ───────────────────────────────────────────────────────
export interface IJwtPayload {
  userId: string;
  email: string;
}