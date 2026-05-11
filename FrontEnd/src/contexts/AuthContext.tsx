import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '@/api/auth.api';

import type { User, RegisterInput, LoginInput } from '@/types/auth.types';
import { tokenStorage } from '@/utils/axios';
import { AuthContext } from './auth.context';

// ── Provider (only component export) ─────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount via silent refresh
  // Uses fetch directly to avoid the axios interceptor's /login redirect on failure
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) return;

        const body = (await res.json()) as {
          data: { tokens: { accessToken: string } };
        };
        const accessToken = body.data?.tokens?.accessToken;
        if (!accessToken) return;

        tokenStorage.set({ accessToken });
        const currentUser = await authApi.getMe();
        setUser(currentUser);
      } catch {
        // No valid session — stay as unauthenticated
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authApi.register(input);
    tokenStorage.set(result.tokens);
    setUser(result.user);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const result = await authApi.login(input);
    tokenStorage.set(result.tokens);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local state regardless
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
    } catch {
      // /me failed (typically 401 from expired/revoked token). Clearing the
      // local user causes ProtectedRoute to redirect to /login with the
      // requested location preserved. This is the right user-visible
      // outcome for any auth failure.
      setUser(null);
    }
  }, []);

  const isAuthenticated = !!user;

  // Auto-refresh /me when the window regains focus, so stale tabs catch up
  // on verification state, password changes, or logouts that happened
  // elsewhere (other tab / device). Only active while authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = () => { void refreshUser(); };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [isAuthenticated, refreshUser]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated, register, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}