// Library-agnostic domain types. Nothing about the transport (fetch) or the
// chart library leaks into these — both are swappable behind their own modules.

export interface MetricMeta {
  label?: string | null;
  higherIsBetter?: boolean | null;
  format?: string | null;
}

/** Display metadata for a prefix group (keyed by prefix; "" = unprefixed group). */
export interface GroupMeta {
  label?: string | null;
}

export type Aggregation = "sum" | "mean" | "max" | "min" | "last" | "count";

export interface TotalMeta {
  /** Per-iteration metric key to aggregate; absent for a static total. */
  metric?: string | null;
  /** Standalone run-level value shown verbatim; absent for an aggregated total. */
  value?: number | null;
  label?: string | null;
  aggregation: Aggregation;
  format?: string | null;
  /** Unit string attached verbatim to the value (include own spacing); absent for a bare number. */
  unit?: string | null;
  /** Whether `unit` is prepended or appended. Defaults to suffix. */
  unitPosition?: "prefix" | "suffix";
}

export interface RunMeta {
  name: string;
  metrics: Record<string, MetricMeta>;
  metricSets: Record<string, string[]>;
  defaultMetricSet?: string | null;
  /** Per-prefix display metadata; the reserved key "" names the unprefixed group. */
  groups?: Record<string, GroupMeta>;
  totals?: TotalMeta[];
}

export type ArtifactType = "diff" | "code" | "file";

export interface Artifact {
  type: ArtifactType;
  path: string;
  label?: string | null;
  language?: string | null;
}

export interface Iteration {
  id: string;
  parent?: string | null;
  timestamp?: string | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  metrics: Record<string, number>;
  island?: number | null;
  inspirations?: string[];
  artifacts: Artifact[];
  tags: string[];
}

export interface ClientConfig {
  pollIntervalMs: number;
  /** Absolute root datadirs are browsed/resolved under. */
  root: string;
  /** Datadir to open on startup, or null to land on the home picker. */
  initialDatadir: string | null;
}

/** One child directory returned by the browse endpoint for path autocomplete. */
export interface BrowseEntry {
  path: string;
  name: string;
  isDatadir: boolean;
}

/** Outcome of validating a candidate datadir path. */
export interface ValidateResult {
  valid: boolean;
  isDatadir: boolean;
  name: string | null;
}
