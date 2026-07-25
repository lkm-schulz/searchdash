import { useCallback, useEffect, useRef, useState } from "react";
import { fetchIterations, fetchRun } from "../api/client";
import type { Iteration, RunMeta } from "../api/types";
import { compareByTimestamp, iterationsById } from "../format";

export interface RunData {
  /** Resolved run metadata, or null until first load. */
  run: RunMeta | null;
  /** Iteration records, kept in chronological (timestamp) order, merged incrementally on refresh. */
  iterations: Iteration[];
  /** Whether the initial load is still in flight. */
  loading: boolean;
  /** Last error message, if any. */
  error: string | null;
  /** Timestamp (ms) of the last successful iterations fetch. */
  lastUpdated: number | null;
  /** Re-fetch iterations and merge them into state without a reload. */
  refresh: () => Promise<void>;
}

/** Merge fetched iterations into existing state, replacing by id and re-sorting chronologically. */
function mergeIterations(previous: Iteration[], incoming: Iteration[]): Iteration[] {
  const byId = iterationsById(previous);
  for (const it of incoming) byId.set(it.id, it);
  return Array.from(byId.values()).sort(compareByTimestamp);
}

/**
 * Loads run metadata + iterations for `datadir`, then exposes a refresh() that
 * merges incrementally (charts and list grow, no full reload). Switching
 * `datadir` resets the accumulated iterations and reloads from scratch.
 */
export function useRunData(datadir: string): RunData {
  const [run, setRun] = useState<RunMeta | null>(null);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const incoming = await fetchIterations(datadir);
      if (!mounted.current) return;
      setIterations((prev) => mergeIterations(prev, incoming));
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [datadir]);

  useEffect(() => {
    mounted.current = true;
    setRun(null);
    setIterations([]);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [runMeta, incoming] = await Promise.all([fetchRun(datadir), fetchIterations(datadir)]);
        if (!mounted.current) return;
        setRun(runMeta);
        setIterations(incoming.slice().sort(compareByTimestamp));
        setLastUpdated(Date.now());
      } catch (err) {
        if (mounted.current) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [datadir]);

  return { run, iterations, loading, error, lastUpdated, refresh };
}
