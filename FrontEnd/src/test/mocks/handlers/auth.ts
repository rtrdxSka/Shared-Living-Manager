import { http, HttpResponse } from 'msw';
import { mockUser } from '../data/user';
import type {
  ApiSuccessResponse,
  AuthResponse,
  ApiMessageResponse,
} from '@/types/auth.types';

const loginSuccess: ApiSuccessResponse<AuthResponse> = {
  status: 'success',
  data: {
    user: mockUser,
    tokens: { accessToken: 'test-access-token' },
  },
};

const logoutSuccess: ApiMessageResponse = {
  status: 'success',
  message: 'Logged out',
};

export const authHandlers = [
  http.post('/api/auth/login', () => HttpResponse.json(loginSuccess)),
  http.post('/api/auth/register', () => HttpResponse.json(loginSuccess)),
  http.post('/api/auth/refresh', () =>
    HttpResponse.json(
      { status: 'error', message: 'Unauthorized' },
      { status: 401 },
    ),
  ),
  http.get('/api/auth/me', () =>
    HttpResponse.json(
      { status: 'error', message: 'Unauthorized' },
      { status: 401 },
    ),
  ),
  http.post('/api/auth/logout', () => HttpResponse.json(logoutSuccess)),
];
