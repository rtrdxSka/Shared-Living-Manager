export type NotificationFrequency = 'instant' | 'daily' | 'weekly';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  frequency: NotificationFrequency;
}

export interface UserPreferences {
  language: string;
  currency: string;
  notifications: NotificationPreferences;
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  households: string[];
  activeHousehold?: string;
  preferences: UserPreferences;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ApiSuccessResponse<T> {
  status: 'success';
  data: T;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  errors?: { field: string; message: string }[];
}

export interface ApiMessageResponse {
  status: 'success';
  message: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}