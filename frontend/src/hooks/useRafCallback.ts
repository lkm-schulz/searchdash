import { useCallback, useEffect, useRef } from "react";

/**
 * Coalesces rapid calls into a single invocation per animation frame, always
 * with the most recent argument. Used to throttle high-frequency `plotly_hover`
 * events that would otherwise re-plot every linked chart on each mousemove.
 */
export function useRafCallback<T>(callback: (value: T) => void): (value: T) => void {
  const latest = useRef<T | null>(null);
  const frame = useRef<number | null>(null);
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return useCallback((value: T) => {
    latest.current = value;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      saved.current(latest.current as T);
    });
  }, []);
}
