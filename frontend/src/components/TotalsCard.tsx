import { useState } from "react";
import type { Aggregation, Iteration, RunMeta, TotalMeta } from "../api/types";
import { aggregate, formatMetric, metricLabel, metricMeta, stats } from "../format";
import PillToggle from "./PillToggle";

/** When true, expose pill filters to choose which totals are visible. Ships off. */
const TOTALS_SELECTABLE = false;

/** Short aggregation label shown as a chip on each tile. */
const AGG_CHIP: Record<Aggregation, string> = {
  sum: "∑ sum",
  mean: "mean",
  max: "max",
  min: "min",
  last: "last",
  count: "count",
};

interface TotalsCardProps {
  run: RunMeta | null;
  iterations: Iteration[];
}

/** Stable identity for a total: its metric key, or a label-derived key for static totals. */
function totalKey(total: TotalMeta): string {
  return total.metric ?? `static:${total.label ?? ""}`;
}

/** Attach the total's unit (verbatim) to a formatted value, as prefix or suffix. */
function withUnit(total: TotalMeta, text: string): string {
  if (!total.unit) return text;
  return total.unitPosition === "prefix" ? `${total.unit}${text}` : `${text}${total.unit}`;
}

/** Full-width run-level rollup: one stat tile per configured total in `run.totals`. */
export default function TotalsCard({ run, iterations }: TotalsCardProps) {
  const totals = run?.totals ?? [];
  const [visible, setVisible] = useState<Set<string>>(() => new Set(totals.map(totalKey)));

  if (totals.length === 0) return null;

  const shown = TOTALS_SELECTABLE ? totals.filter((t) => visible.has(totalKey(t))) : totals;

  const toggle = (key: string, on: boolean) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const tileFor = (total: TotalMeta, index: number) => {
    const key = `${totalKey(total)}:${index}`;
    // Count-all total: neither metric nor value — counts every iteration regardless
    // of which metrics it carries. Carries the `count` chip and no distribution.
    if (total.metric == null && total.value == null) {
      const fmt = (value: number) => formatMetric(value, total.format ? { format: total.format } : null);
      return (
        <div className="total-tile" key={key}>
          <div className="total-top">
            <span className="total-label">{total.label}</span>
            <span className="total-chip">{AGG_CHIP.count}</span>
          </div>
          <div className="total-value">{withUnit(total, fmt(iterations.length))}</div>
        </div>
      );
    }
    // Static total: a standalone value entered directly in run.json — no metric, no distribution.
    if (total.metric == null) {
      const fmt = (value: number) => formatMetric(value, total.format ? { format: total.format } : null);
      return (
        <div className="total-tile" key={key}>
          <div className="total-top">
            <span className="total-label">{total.label}</span>
          </div>
          <div className="total-value">{total.value == null ? "—" : withUnit(total, fmt(total.value))}</div>
        </div>
      );
    }
    const meta = metricMeta(run, total.metric);
    const values = iterations
      .map((it) => it.metrics[total.metric as string])
      .filter((v): v is number => v !== undefined && v !== null);
    const result = aggregate(values, total.aggregation);
    const label = total.label ?? metricLabel(run, total.metric);
    const formatMeta = total.format ? { format: total.format } : meta;
    const fmt = (value: number) => formatMetric(value, formatMeta);
    // Distribution context only helps value aggregations; `count` has none.
    const dist = total.aggregation === "count" ? null : stats(values);
    return (
      <div className="total-tile" key={key}>
        <div className="total-top">
          <span className="total-label">{label}</span>
          <span className="total-chip">{AGG_CHIP[total.aggregation]}</span>
        </div>
        <div className="total-value">{result === null ? "—" : withUnit(total, fmt(result))}</div>
        {dist && (
          <div className="total-dist">
            <div className="dist-item">
              <span className="dist-key">min</span>
              <span className="dist-val">{fmt(dist.min)}</span>
            </div>
            <div className="dist-item">
              <span className="dist-key">med</span>
              <span className="dist-val">{fmt(dist.median)}</span>
            </div>
            <div className="dist-item">
              <span className="dist-key">mean</span>
              <span className="dist-val">{fmt(dist.mean)}</span>
            </div>
            <div className="dist-item">
              <span className="dist-key">max</span>
              <span className="dist-val">{fmt(dist.max)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="totals-card">
      <h3 className="totals-heading">Totals</h3>
      {TOTALS_SELECTABLE && (
        <div className="totals-pills">
          {totals.map((total) => (
            <PillToggle
              key={totalKey(total)}
              checked={visible.has(totalKey(total))}
              onChange={(on) => toggle(totalKey(total), on)}
            >
              {total.label ?? (total.metric ? metricLabel(run, total.metric) : "")}
            </PillToggle>
          ))}
        </div>
      )}
      <div className="totals-grid">{shown.map(tileFor)}</div>
    </div>
  );
}
