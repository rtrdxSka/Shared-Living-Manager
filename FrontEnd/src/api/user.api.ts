import api from '@/utils/axios';
import type {
  UpdateProfileInput,
  ChangePasswordInput,
  User,
  ApiSuccessResponse,
  ApiMessageResponse,
} from '@/types/auth.types';

export const userApi = {
  async updateProfile(input: UpdateProfileInput): Promise<User> {
    const { data } = await api.patch<ApiSuccessResponse<{ user: User }> & { message?: string }>(
      '/users/profile',
      input
    );
    return data.data.user;
  },

  async changePassword(input: ChangePasswordInput): Promise<string> {
    const { data } = await api.patch<ApiMessageResponse>(
      '/users/password',
      input
    );
    return data.message;
  },
};
