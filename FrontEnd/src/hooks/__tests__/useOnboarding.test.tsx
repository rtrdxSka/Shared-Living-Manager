import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOnboarding } from '../useOnboarding';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

describe('useOnboarding', () => {
  it('throws when used outside OnboardingProvider', () => {
    expect(() => renderHook(() => useOnboarding())).toThrow(
      /useOnboarding must be used within an OnboardingProvider/,
    );
  });

  it('returns context value when used inside OnboardingProvider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OnboardingProvider>{children}</OnboardingProvider>
    );
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
  });
});
