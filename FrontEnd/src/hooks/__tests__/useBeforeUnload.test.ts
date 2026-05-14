import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnload } from '../useBeforeUnload';

describe('useBeforeUnload', () => {
  it('attaches a beforeunload listener when active=true', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useBeforeUnload(true));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });

  it('does NOT attach a beforeunload listener when active=false', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useBeforeUnload(false));
    const calls = addSpy.mock.calls.filter(([evt]) => evt === 'beforeunload');
    expect(calls).toHaveLength(0);
    addSpy.mockRestore();
  });

  it('removes the listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useBeforeUnload(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    removeSpy.mockRestore();
  });
});
