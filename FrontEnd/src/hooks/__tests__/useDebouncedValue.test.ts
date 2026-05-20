import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 200));
    expect(result.current).toBe('hello');
  });

  it('lags subsequent updates by the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(150); });
    rerender({ value: 'c' });
    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('c');
  });
});
