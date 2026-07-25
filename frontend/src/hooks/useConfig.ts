import { useAsyncData } from "./useAsyncData";
import { fetchConfig } from "../api/client";
import type { ClientConfig } from "../api/types";

/**
 * Loads the launcher-provided client config (poll interval, served root, initial
 * datadir) once. Independent of the selected datadir, so it lives apart from
 * `useRunData` and is fetched at the app shell to drive home-vs-dashboard routing.
 */
export function useConfig(): { config: ClientConfig | null; error: string | null } {
  const { data, error } = useAsyncData(fetchConfig, []);
  return { config: data, error };
}
