import api from '@/utils/axios';
import type {
  RegisterInput,
  LoginInput,
  AuthResponse,
  User,
  ApiSuccessResponse,
  ApiMessageResponse,
} from '@/types/auth.types';


export const authApi = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { data } = await api.post<ApiSuccessResponse<AuthResponse>>(
      '/auth/register',
      input
    );
    return data.data;
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const { data } = await api.post<ApiSuccessResponse<AuthResponse>>(
      '/auth/login',
      input
    );
    return data.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<ApiSuccessResponse<{ user: User }>>(
      '/auth/me'
    );
    return data.data.user;
  },

  async verifyEmail(token: string): Promise<string> {
    const { data } = await api.post<ApiMessageResponse>(
      '/auth/verify-email',
      { token }
    );
    return data.message;
  },

  async resendVerification(): Promise<string> {
    const { data } = await api.post<ApiMessageResponse>(
      '/auth/resend-verification'
    );
    return data.message;
  },

  async forgotPassword(email: string): Promise<string> {
    const { data } = await api.post<ApiMessageResponse>(
      '/auth/forgot-password',
      { email }
    );
    return data.message;
  },

  async resetPassword(token: string, password: string): Promise<string> {
    const { data } = await api.post<ApiMessageResponse>(
      '/auth/reset-password',
      { token, password }
    );
    return data.message;
  },
};