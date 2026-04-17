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
    const currentUser = await authApi.getMe();
    setUser(currentUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, register, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}