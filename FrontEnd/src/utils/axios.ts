import axios from 'axios';
import type { AuthTokens, ApiSuccessResponse } from '@/types/auth.types';

const TOKEN_KEY = 'auth_tokens';

// ── Token storage ─────────────────────────────────────────────────────

export const tokenStorage = {
  get(): AuthTokens | null {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  },

  set(tokens: AuthTokens): void {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};

// ── Instance ──────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ── Request: inject access token ──────────────────────────────────────

api.interceptors.request.use(
  (config) => {
    const tokens = tokenStorage.get();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response: 401 → refresh → retry queue ─────────────────────────────

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) prom.resolve(token);
    else prom.reject(error);
  });
  failedQueue = [];
};



api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest.url?.includes('/login')) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't recurse on the refresh endpoint itself
    if (originalRequest.url === '/auth/refresh') {
      tokenStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const tokens = tokenStorage.get();
      if (!tokens?.refreshToken) throw new Error('No refresh token');

      const { data } = await api.post<
        ApiSuccessResponse<{ tokens: AuthTokens }>
      >('/auth/refresh', { refreshToken: tokens.refreshToken });

      const newTokens = data.data.tokens;
      tokenStorage.set(newTokens);
      processQueue(null, newTokens.accessToken);

      originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStorage.clear();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;