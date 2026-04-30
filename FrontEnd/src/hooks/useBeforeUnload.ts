import { useEffect } from 'react';

/**
 * Registers a `beforeunload` listener while `active` is true.
 * Catches tab close, hard refresh, and direct URL changes.
 * Modern browsers ignore custom message strings — the browser shows its own confirm dialog.
 *
 * Does NOT catch browser back/forward arrow buttons (would require React Router data router + useBlocker).
 * Does NOT catch in-app `<Link>` clicks (already handled by `useGuardedNavClick` in AppLayout).
 */
export function useBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}
