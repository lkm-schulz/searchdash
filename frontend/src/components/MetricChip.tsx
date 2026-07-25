import type { RunMeta } from "../api/types";
import { formatMetric, metricLabel, metricMeta } from "../format";

interface MetricValueProps {
  run: RunMeta | null;
  metricKey: string;
  value: number;
}

/** Metric label + formatted value as two spans — the shared inner of every
 *  metric chip (and the sticky bar's single-metric readout). */
export function MetricKeyVal({ run, metricKey, value }: MetricValueProps) {
  return (
    <>
      <span className="chip-key">{metricLabel(run, metricKey)}</span>{" "}
      <span className="chip-val">{formatMetric(value, metricMeta(run, metricKey))}</span>
    </>
  );
}

/** One pill-shaped metric chip. */
export function MetricChip({ run, metricKey, value }: MetricValueProps) {
  return (
    <span className="chip">
      <MetricKeyVal run={run} metricKey={metricKey} value={value} />
    </span>
  );
}

/** Wrapped row of metric chips for an iteration's full metric set. */
export function MetricChips({ run, metrics }: { run: RunMeta | null; metrics: Record<string, number> }) {
  return (
    <div className="metric-chips">
      {Object.entries(metrics).map(([key, value]) => (
        <MetricChip key={key} run={run} metricKey={key} value={value} />
      ))}
    </div>
  );
}
