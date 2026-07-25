import { useSyncExternalStore } from "react";

const STORAGE_KEY = "evo.recentDatadirs";
const MAX_RECENT = 10;

function read(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Process-wide recent-datadirs store. Kept in one module-level cache (not React
 * state) so every `useRecentDatadirs` consumer — home list, header history
 * dropdown — sees the same list and updates live when any of them opens a
 * datadir, rather than each holding an independent, drifting copy.
 */
let cache: string[] = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Move `path` to the front (dedup), cap the list, persist, and notify consumers. */
function rememberDatadir(path: string): void {
  cache = [path, ...cache.filter((p) => p !== path)].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  listeners.forEach((listener) => listener());
}

/**
 * Most-recently-opened datadirs, newest first, persisted in `localStorage`
 * (per-origin = per host:port, so history survives across runs on a stable port).
 */
export function useRecentDatadirs(): { recent: string[]; remember: (path: string) => void } {
  const recent = useSyncExternalStore(subscribe, () => cache);
  return { recent, remember: rememberDatadir };
}
