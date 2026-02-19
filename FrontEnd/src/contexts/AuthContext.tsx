import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '@/api/auth.api';

import type { User, RegisterInput, LoginInput } from '@/types/auth.types';
import { tokenStorage } from '@/utils/axios';
import { AuthContext } from './auth.context';

// ── Provider (only component export) ─────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const init = async () => {
      const tokens = tokenStorage.get();
      if (!tokens?.accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authApi.getMe();
        setUser(currentUser);
      } catch {
        tokenStorage.clear();
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

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, register, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}