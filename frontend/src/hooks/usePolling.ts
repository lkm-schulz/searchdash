import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` while `enabled`. Changing the interval
 * restarts the timer; the latest callback is always used without resetting it.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled: boolean): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const handle = window.setInterval(() => saved.current(), intervalMs);
    return () => window.clearInterval(handle);
  }, [intervalMs, enabled]);
}
