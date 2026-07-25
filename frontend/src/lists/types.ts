// Iteration-list adapter contract. The dashboard imports only IterationListView
// (re-exported from ./index) typed by these props — no list-design specifics
// leak out. Swap designs by flipping the re-export in lists/index.ts.

import type { Iteration, RunMeta } from "../api/types";

export interface IterationListProps {
  /** Resolved run metadata for metric labels/formats. */
  run: RunMeta | null;
  /** Iteration records to render (already merged, id-sorted upstream). */
  iterations: Iteration[];
  /** Metric keys in display order (drag-authored); drives per-metric columns. */
  metricKeys: string[];
}
