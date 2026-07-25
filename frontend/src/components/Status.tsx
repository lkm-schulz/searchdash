import type { ReactNode } from "react";

/** Inline error banner; renders nothing when there is no message. */
export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="error-banner">{error}</div>;
}

/** Centered "loading" line, shared by every async view. */
export function LoadingMessage({ children = "Loading…" }: { children?: ReactNode }) {
  return <div className="loading">{children}</div>;
}

/** Centered empty-state line, shared by every list/chart view. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
