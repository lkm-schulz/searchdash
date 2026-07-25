// Small presentation helpers shared across components. Kept library-agnostic.

import type { Aggregation, Iteration, MetricMeta, RunMeta } from "./api/types";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const CLOCK_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Format an ISO timestamp in European style, e.g. "9 Jun 2026, 14:03:07". */
export function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso));
}

/** Format a wall-clock time (epoch ms) as 24-hour HH:MM:SS. */
export function formatClock(ms: number): string {
  return CLOCK_FORMAT.format(new Date(ms));
}

/**
 * Chronological iteration comparator: orders by timestamp ascending, with the
 * iteration id as a stable tiebreaker. Iterations missing a parseable timestamp
 * sink below timed ones (ordered among themselves by id).
 */
export function compareByTimestamp(a: Iteration, b: Iteration): number {
  const at = a.timestamp ? Date.parse(a.timestamp) : NaN;
  const bt = b.timestamp ? Date.parse(b.timestamp) : NaN;
  const aValid = !Number.isNaN(at);
  const bValid = !Number.isNaN(bt);
  if (aValid && bValid && at !== bt) return at - bt;
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;
  return a.id.localeCompare(b.id);
}

/** Index iterations by id for O(1) lookup. */
export function iterationsById(iterations: Iteration[]): Map<string, Iteration> {
  return new Map(iterations.map((it) => [it.id, it]));
}

/** Min and max of `values`, or `null` when empty. */
export function minMax(values: number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Split a metric key into its section prefix and base name on the first `.`:
 * `"train.combined_score"` → `{ prefix: "train", base: "combined_score" }`,
 * `"combined_score"` → `{ prefix: null, base: "combined_score" }`. The prefix is
 * the routine variant tag (train/val/…); the base is what metadata is keyed by.
 */
export function parseMetricKey(key: string): { prefix: string | null; base: string } {
  const dot = key.indexOf(".");
  if (dot === -1) return { prefix: null, base: key };
  return { prefix: key.slice(0, dot), base: key.slice(dot + 1) };
}

/**
 * Metadata for a metric key with base-name fallback: an exact full-key entry in
 * `run.metrics` wins, else the base-name entry applies (so `train.X` inherits the
 * definition of `X`). The single source for every label/format/higherIsBetter
 * read — route all metadata lookups through here so base-name declarations apply
 * to every prefixed variant.
 */
export function metricMeta(run: RunMeta | null, key: string): MetricMeta | undefined {
  return run?.metrics[key] ?? run?.metrics[parseMetricKey(key).base];
}

/**
 * Reconcile a stored order array against the items currently present: keep
 * present entries in their stored order, then append any newly-appeared items
 * (in `present` order). Drops entries whose item vanished. Used to keep the
 * drag-order state in sync with the metric set across live polling and to seed
 * it on first load.
 */
export function reconcileOrder<T>(prev: T[], present: T[]): T[] {
  const presentSet = new Set(present);
  const kept = prev.filter((item) => presentSet.has(item));
  const seen = new Set(kept);
  for (const item of present) {
    if (!seen.has(item)) {
      kept.push(item);
      seen.add(item);
    }
  }
  // Nothing dropped or appended: return the original ref so a useState setter
  // receiving it bails out of a re-render (and downstream memos keep identity).
  if (kept.length === prev.length && kept.every((item, index) => Object.is(item, prev[index]))) {
    return prev;
  }
  return kept;
}

/**
 * Reorder metric groups to match user-authored order arrays: groups by
 * `groupsOrder`, and the keys within each group by `basesOrder`. Pure reorder —
 * no filtering, no selection applied. Entries absent from an order array rank
 * last (stable), so a stale order state across a metric set change or before
 * initialization degrades gracefully to the canonical {@link groupMetricKeys}
 * order. The single source of order application — every consumer (charts, table
 * rows, graph node rows, iteration-table columns) routes through here so a drag
 * on one page reflows everywhere.
 */
export function reorderGroups(
  groups: MetricGroup[],
  groupsOrder: (string | null)[],
  basesOrder: string[],
): MetricGroup[] {
  const groupRank = new Map<string | null, number>();
  groupsOrder.forEach((prefix, index) => groupRank.set(prefix, index));
  const baseRank = new Map<string, number>();
  basesOrder.forEach((base, index) => baseRank.set(base, index));
  const rank = (r: number | undefined) => (r === undefined ? Number.POSITIVE_INFINITY : r);
  return groups
    .map((group) => ({
      prefix: group.prefix,
      keys: [...group.keys].sort(
        (a, b) => rank(baseRank.get(parseMetricKey(a).base)) - rank(baseRank.get(parseMetricKey(b).base)),
      ),
    }))
    .sort((a, b) => rank(groupRank.get(a.prefix)) - rank(groupRank.get(b.prefix)));
}

/**
 * Bare base label for a metric, ignoring any prefix (`metricMeta(...).label`,
 * else the base name). Used where the prefix is surfaced separately — panel
 * pills and chart titles paired with a prefix tag.
 */
export function metricBaseLabel(run: RunMeta | null, key: string): string {
  return metricMeta(run, key)?.label ?? parseMetricKey(key).base;
}

/**
 * Human-facing label for a metric key. An explicit full-key label wins; else the
 * base label is prefixed for clarity (`"train · Combined score"`), or shown bare
 * when unprefixed. Standalone callers (graph nodes, scatter axes, totals, detail
 * deltas) get an unambiguous, prefix-aware label.
 */
export function metricLabel(run: RunMeta | null, key: string): string {
  const explicit = run?.metrics[key]?.label;
  if (explicit) return explicit;
  const { prefix } = parseMetricKey(key);
  const baseLabel = metricBaseLabel(run, key);
  return prefix ? `${prefix} · ${baseLabel}` : baseLabel;
}

/**
 * Display name for a prefix group. An explicit `run.groups[prefix].label` wins
 * (the reserved key `""` names the unprefixed group); otherwise the raw prefix,
 * or "General" for the unprefixed group. The single source for group naming.
 */
export function groupLabel(run: RunMeta | null, prefix: string | null): string {
  return run?.groups?.[prefix ?? ""]?.label ?? (prefix ?? "General");
}

/** A run's metric keys for one prefix section; `prefix` is null for the unprefixed group. */
export interface MetricGroup {
  /** Section prefix (e.g. "train"), or null for the unprefixed group. */
  prefix: string | null;
  /** Full metric keys in this section, in display order. */
  keys: string[];
}

/**
 * Group the metric keys present in the iteration data by section prefix. Keys are
 * drawn from iteration data only — not from `run.metrics` — so base-name-only
 * declarations stay pure metadata and never spawn phantom series. The unprefixed
 * group comes first; prefixed groups follow in first-appearance order. Within a
 * group keys are ordered by their base metric's index in `run.metrics`, falling
 * back to first appearance for undeclared metrics.
 */
export function groupMetricKeys(run: RunMeta | null, iterations: Iteration[]): MetricGroup[] {
  const dataKeys = allMetricKeys(iterations.map((it) => it.metrics));
  const baseOrder = run ? Object.keys(run.metrics) : [];
  const baseRank = (key: string) => {
    const index = baseOrder.indexOf(parseMetricKey(key).base);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  const byPrefix = new Map<string | null, string[]>();
  for (const key of dataKeys) {
    const { prefix } = parseMetricKey(key);
    const bucket = byPrefix.get(prefix);
    if (bucket) bucket.push(key);
    else byPrefix.set(prefix, [key]);
  }

  const prefixes: (string | null)[] = byPrefix.has(null) ? [null] : [];
  for (const prefix of byPrefix.keys()) {
    if (prefix !== null) prefixes.push(prefix);
  }

  // Array#sort is stable, so equal-rank keys keep their first-appearance order.
  return prefixes.map((prefix) => ({
    prefix,
    keys: [...byPrefix.get(prefix)!].sort((a, b) => baseRank(a) - baseRank(b)),
  }));
}

/**
 * Distinct base metric names across the groups, in display order (the unprefixed
 * group's declaration order first, then any base seen only in a prefixed group).
 * Metrics are selected by base name once; the prefix is chosen separately.
 */
export function metricBaseNames(groups: MetricGroup[]): string[] {
  const seen = new Set<string>();
  const bases: string[] = [];
  for (const group of groups) {
    for (const key of group.keys) {
      const { base } = parseMetricKey(key);
      if (!seen.has(base)) {
        seen.add(base);
        bases.push(base);
      }
    }
  }
  return bases;
}

/**
 * Map metric-set entries (authored by base name, full keys tolerated) to the
 * base names actually present, deduped and in entry order. Lets base-name presets
 * drive the single base-metric selection.
 */
export function metricSetBases(entries: string[], bases: string[]): string[] {
  const available = new Set(bases);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const { base } = parseMetricKey(entry);
    if (available.has(base) && !seen.has(base)) {
      seen.add(base);
      result.push(base);
    }
  }
  return result;
}

/**
 * The full keys to chart: those whose base is selected and whose prefix group is
 * selected. Preserves the order of `allKeys`, so pass {@link reorderGroups}
 * output to get drag-ordered keys back.
 */
export function selectMetricKeys(
  allKeys: string[],
  selectedBases: string[],
  selectedGroups: (string | null)[],
): string[] {
  const baseSet = new Set(selectedBases);
  const groupSet = new Set(selectedGroups);
  return allKeys.filter((key) => {
    const { prefix, base } = parseMetricKey(key);
    return baseSet.has(base) && groupSet.has(prefix);
  });
}

/**
 * Base-major regrouping of the metric keys: one entry per base (in `baseOrder`,
 * falling back to {@link metricBaseNames} for any base the order array omits),
 * holding that base's variant keys gathered across the groups in group order.
 * Drives interleaved ("base-major") chart ordering —
 * `met_A, val.met_A, met_B, val.met_B, …` — and per-base sections. Honoring the
 * drag-authored `baseOrder` keeps a prefixed-only base where the user placed it
 * rather than where first-appearance would sink it.
 */
function keysByBase(
  groups: MetricGroup[],
  baseOrder: string[],
): { base: string; keys: string[] }[] {
  const order = baseOrder.length > 0 ? baseOrder : metricBaseNames(groups);
  return order
    .map((base) => ({
      base,
      keys: groups.flatMap((group) => group.keys.filter((key) => parseMetricKey(key).base === base)),
    }))
    .filter((entry) => entry.keys.length > 0);
}

/** A run of charts rendered together, optionally under a foldable section header. */
export interface ChartSection {
  /** Stable id used as the fold key. */
  id: string;
  /** Header label; `null` renders the charts with no header (flow mode). */
  label: string | null;
  /** Full metric keys charted in this section, in display order. */
  keys: string[];
}

/**
 * Partition the charted metric keys into sections, honoring the two Display
 * toggles. Without separation everything lands in one headerless section, keys
 * ordered group-major (the canonical order) or base-major when interleaved.
 * With separation each section gets a foldable header: per prefix group
 * (group-major) or per base metric (interleaved). `baseOrder` is the
 * drag-authored base order, used only for the interleaved base-major layout.
 */
export function chartSections(
  run: RunMeta | null,
  groups: MetricGroup[],
  interleave: boolean,
  separate: boolean,
  baseOrder: string[] = [],
): ChartSection[] {
  if (!separate) {
    const keys = interleave
      ? keysByBase(groups, baseOrder).flatMap((entry) => entry.keys)
      : groups.flatMap((group) => group.keys);
    return [{ id: "__all__", label: null, keys }];
  }
  if (interleave) {
    return keysByBase(groups, baseOrder).map((entry) => ({
      id: `base:${entry.base}`,
      label: metricBaseLabel(run, entry.base),
      keys: entry.keys,
    }));
  }
  return groups.map((group) => ({
    id: `prefix:${group.prefix ?? ""}`,
    label: groupLabel(run, group.prefix),
    keys: group.keys,
  }));
}

/**
 * Format a metric value honoring a Python-style float spec like ".3f".
 * Only the common `.<n>f` form is supported; anything else falls back to a
 * compact default. Integers and the whole part are grouped with thousands
 * separators so large totals read cleanly (e.g. "1,188.1").
 */
export function formatMetric(value: number, meta?: MetricMeta | null): string {
  const spec = meta?.format;
  if (spec) {
    const match = /^\.(\d+)f$/.exec(spec);
    if (match) {
      const digits = Number(match[1]);
      return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }
  }
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/**
 * Combine per-iteration values for a Totals tile. Missing entries are filtered
 * by the caller; `count` returns the number of present values, and an empty set
 * yields `null` (rendered as a dash).
 */
export function aggregate(values: number[], agg: Aggregation): number | null {
  if (agg === "count") return values.length;
  if (values.length === 0) return null;
  switch (agg) {
    case "sum":
      return values.reduce((acc, v) => acc + v, 0);
    case "mean":
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    case "max":
      return Math.max(...values);
    case "min":
      return Math.min(...values);
    case "last":
      return values[values.length - 1];
  }
}

/** Distribution summary of a metric's per-iteration values. */
export interface ValueStats {
  min: number;
  max: number;
  median: number;
  mean: number;
}

/** Min/max/median/mean of `values`, or `null` when empty. */
export function stats(values: number[]): ValueStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const mean = sorted.reduce((acc, v) => acc + v, 0) / n;
  return { min: sorted[0], max: sorted[n - 1], median, mean };
}

/** Ordered union of all metric keys appearing across iterations. */
export function allMetricKeys(metricRecords: Array<Record<string, number>>): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const metrics of metricRecords) {
    for (const key of Object.keys(metrics)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}
