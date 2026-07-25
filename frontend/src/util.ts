// Tiny presentation-agnostic helpers shared across components.

/** Join truthy class names with spaces; falsy entries are dropped. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Fish-shell-style path abbreviation: every component except the last two is
 * reduced to its first character, keeping the two most informative components
 * intact. `/home/user/work/experiments/my-run` → `/h/u/w/experiments/my-run`.
 */
export function abbreviatePath(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/");
  if (segments.length <= 1) return path;
  const keepFrom = segments.length - 2;
  return segments
    .map((segment, index) => (index >= keepFrom || segment === "" ? segment : segment[0]))
    .join("/");
}

/** Append a `datadir` query param to `path` when one is set. */
export function withDatadir(path: string, datadir: string | null): string {
  return datadir ? `${path}?${new URLSearchParams({ datadir }).toString()}` : path;
}

/** Route path to an iteration's detail page, carrying the current datadir. */
export function iterationPath(id: string, datadir: string | null): string {
  return withDatadir(`/iteration/${encodeURIComponent(id)}`, datadir);
}

/** Route path to the dashboard for `datadir` (root, with the datadir query). */
export function dashboardPath(datadir: string | null): string {
  return withDatadir("/", datadir);
}
