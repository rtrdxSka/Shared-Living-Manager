import { useEffect } from 'react';

/**
 * Registers a `beforeunload` listener while `active` is true.
 * Catches tab close, hard refresh, and direct URL changes.
 * Modern browsers ignore custom message strings — the browser shows its own confirm dialog.
 *
 * Does NOT catch in-app `<Link>` clicks or browser back/forward — those are handled by
 * `useBlocker` in `ShoppingListPage`.
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
