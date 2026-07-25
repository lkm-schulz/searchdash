import { useEffect, useState } from "react";

/**
 * `useState` backed by `sessionStorage`, so the value survives a route element
 * unmount (e.g. navigating to a detail page and back) and a page reload, scoped
 * to the browser tab. Each searchdash instance runs on its own origin, so keys
 * never collide across runs.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stored = sessionStorage.getItem(key);
    if (stored === null) return initial;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
