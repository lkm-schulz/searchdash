// Opt-in, zero-cost-when-off perf instrumentation for the chart layer. The
// dashboard mounts one Plotly graph per metric, so a display-setting toggle can
// re-plot or mount many graphs at once; this surfaces how many and how much
// main-thread time that costs.
//
// Enable from the browser console with `window.__evoPerf = true`, then interact:
// each settled burst of chart work logs one summary table (counts + ms per op).
// Set it back to `false` to silence. When off, `timed` is a pass-through and
// `count` a no-op, so it can stay wired in permanently.

interface Bucket {
  /** Number of recorded events in this burst. */
  count: number;
  /** Summed synchronous duration in ms (0 for pure counters like mounts). */
  totalMs: number;
  /** Slowest single event in ms. */
  maxMs: number;
}

declare global {
  interface Window {
    /** Set true in the console to stream chart perf summaries. */
    __evoPerf?: boolean;
  }
}

/** Per-op tallies for the current (not-yet-flushed) burst. */
const buckets = new Map<string, Bucket>();
/** Wall-clock start of the current burst (first event since the last flush). */
let windowStart = 0;
/** Whether a flush is already queued for the end of this task. */
let flushScheduled = false;

/** Whether instrumentation is currently armed. */
function enabled(): boolean {
  return typeof window !== "undefined" && window.__evoPerf === true;
}

/** Fold one timed/counted event into its bucket and queue a burst flush. */
function record(op: string, ms: number): void {
  if (buckets.size === 0) windowStart = performance.now();
  const bucket = buckets.get(op) ?? { count: 0, totalMs: 0, maxMs: 0 };
  bucket.count += 1;
  bucket.totalMs += ms;
  bucket.maxMs = Math.max(bucket.maxMs, ms);
  buckets.set(op, bucket);
  if (!flushScheduled) {
    flushScheduled = true;
    // Flush after the current synchronous burst settles, so one interaction
    // yields one summary instead of N log lines.
    setTimeout(flush, 0);
  }
}

/** Summarize and clear the current burst once the synchronous work settles. */
function flush(): void {
  flushScheduled = false;
  if (buckets.size === 0) return;
  const wallMs = performance.now() - windowStart;
  const rows = [...buckets]
    .map(([op, bucket]) => ({
      op,
      count: bucket.count,
      totalMs: Number(bucket.totalMs.toFixed(1)),
      avgMs: Number((bucket.totalMs / bucket.count).toFixed(2)),
      maxMs: Number(bucket.maxMs.toFixed(1)),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);
  buckets.clear();
  console.groupCollapsed(`[evo-perf] chart burst — ${wallMs.toFixed(1)}ms wall`);
  console.table(rows);
  console.groupEnd();
}

/** Time `fn`, attributing its synchronous duration to `op`. Pass-through when off. */
export function timed<T>(op: string, fn: () => T): T {
  if (!enabled()) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    record(op, performance.now() - start);
  }
}

/** Tally one occurrence of `op` (e.g. a chart mount/unmount). No-op when off. */
export function count(op: string): void {
  if (!enabled()) return;
  record(op, 0);
}
