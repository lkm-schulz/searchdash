import { useSearchParams } from "react-router-dom";

/**
 * The datadir currently being viewed, read from the `?datadir=` query param.
 *
 * The URL is the single source of truth for which experiment is shown, so any
 * component under the router reads it here rather than receiving it as a prop.
 * Returns null when no datadir is selected (the home picker).
 */
export function useDatadir(): string | null {
  const [params] = useSearchParams();
  return params.get("datadir");
}
