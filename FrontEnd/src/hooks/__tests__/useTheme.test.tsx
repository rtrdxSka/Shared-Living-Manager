import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { ThemeProvider } from '@/components/ThemeProvider';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns theme + setters when used inside ThemeProvider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('light');
    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.toggleTheme).toBe('function');
  });

  it('setTheme updates the theme value', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
  });
});
