import { useEffect, useState } from 'react';

/**
 * Returns a value that lags the input by `delayMs` of idle time.
 * Each new input resets the timer, so updates only flow through after
 * the caller has stopped changing the value for `delayMs` milliseconds.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
