import { useEffect, useState } from "react";

/** Result of an in-flight or settled async load. */
export interface AsyncData<T> {
  /** Resolved value, or null until the first successful load. */
  data: T | null;
  /** Error message from the latest attempt, or null. */
  error: string | null;
}

/**
 * Run `factory` on mount and whenever `deps` change, tracking its result and
 * error. A result that resolves after `deps` changed (or the component unmounts)
 * is ignored, so stale loads never overwrite fresh state.
 */
export function useAsyncData<T>(factory: () => Promise<T>, deps: React.DependencyList): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    factory()
      .then((value) => active && setData(value))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, error };
}
