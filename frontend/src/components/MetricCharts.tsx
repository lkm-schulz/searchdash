import { useMemo, type ReactNode } from "react";
import { LineChartView } from "../charts";
import type { ChartHover, LinePoint } from "../charts";
import type { Iteration, RunMeta } from "../api/types";
import { chartSections, formatMetric, groupLabel, metricBaseLabel, metricMeta, parseMetricKey, type MetricGroup } from "../format";
import { cn } from "../util";
import { EmptyState } from "./Status";

interface MetricChartsProps {
  run: RunMeta | null;
  iterations: Iteration[];
  /** Selected metrics grouped by prefix section (already filtered to selection). */
  groups: MetricGroup[];
  /** Drag-authored base order, used for the interleaved base-major layout. */
  basesOrder: string[];
  /** Break charts into foldable sections (per prefix group, or per base when interleaved). */
  separateSections: boolean;
  /** Order charts base-major (`met, val.met, …`) instead of group-major. */
  interleave: boolean;
  /** Ids of sections currently folded (header shown, charts hidden). */
  foldedSections: string[];
  /** Toggle a section's folded state by id. */
  onToggleFold: (id: string) => void;
  onPointClick: (id: string) => void;
  /** Split each chart into one colored line per island. */
  colorByIsland: boolean;
  /** Iteration hovered across the linked charts (null when none). */
  hover: ChartHover | null;
  /** Report the hovered iteration to the linked-chart group. */
  onHover: (hover: ChartHover | null) => void;
}

/** One line chart per selected metric (x = iteration order), organized into sections. */
export default function MetricCharts({
  run,
  iterations,
  groups,
  basesOrder,
  separateSections,
  interleave,
  foldedSections,
  onToggleFold,
  onPointClick,
  colorByIsland,
  hover,
  onHover,
}: MetricChartsProps) {
  // Canonical flat key list (independent of section ordering) drives the point
  // memo so a hover-driven re-render reuses the same array identities.
  const metrics = useMemo(() => groups.flatMap((group) => group.keys), [groups]);
  const sections = useMemo(
    () => chartSections(run, groups, interleave, separateSections, basesOrder),
    [run, groups, interleave, separateSections, basesOrder],
  );
  const foldedSet = useMemo(() => new Set(foldedSections), [foldedSections]);

  // Memoized per-metric point arrays, keyed on iterations + selection: a
  // hover-driven re-render leaves both unchanged, so the charts reuse the same
  // array identities instead of every chart rebuilding its data.
  const pointsByMetric = useMemo(() => {
    const byMetric = new Map<string, LinePoint[]>();
    for (const key of metrics) {
      byMetric.set(
        key,
        iterations.map((it, index) => ({
          id: it.id,
          // 0-based so the baseline iteration reads "0" natively.
          x: index,
          y: key in it.metrics ? it.metrics[key] : null,
          label: it.id,
          island: it.island ?? null,
        })),
      );
    }
    return byMetric;
  }, [iterations, metrics]);

  // Stable per-metric formatter identities. Rebuilt only when the run/selection
  // changes — not on hover or a section toggle — so the memoized traces/layout in
  // each LineChartView survive those re-renders instead of forcing a re-plot.
  const formatters = useMemo(() => {
    const byMetric = new Map<string, (value: number) => string>();
    for (const key of metrics) {
      const meta = metricMeta(run, key);
      byMetric.set(key, (value: number) => formatMetric(value, meta));
    }
    return byMetric;
  }, [run, metrics]);

  if (metrics.length === 0) {
    return <EmptyState>No metrics selected.</EmptyState>;
  }

  // A per-prefix section header already names the group, so its charts need no
  // tag; flow mode and per-base sections do (to tell the prefix variants apart),
  // but the unprefixed "General" variant stays bare as elsewhere.
  const showChartPrefix = !separateSections || interleave;
  const renderChart = (key: string) => {
    const { prefix } = parseMetricKey(key);
    return (
      <LineChartView
        key={key}
        chartId={key}
        title={metricBaseLabel(run, key)}
        prefix={showChartPrefix && prefix !== null ? groupLabel(run, prefix) : null}
        points={pointsByMetric.get(key) ?? []}
        onPointClick={onPointClick}
        formatValue={formatters.get(key)}
        colorByIsland={colorByIsland}
        hover={hover}
        onHover={onHover}
      />
    );
  };

  // Flatten headers + charts into one keyed sibling list rather than a Fragment
  // per section. Chart keys are the (section-independent) metric keys and headers
  // are transparent in the grid, so a section restructure is a flat keyed-list
  // diff — which gives React the chance to move charts rather than recreate them.
  const children = sections.flatMap((section): ReactNode[] => {
    const folded = foldedSet.has(section.id);
    const items: ReactNode[] = [];
    if (section.label !== null) {
      items.push(
        <button
          key={`header:${section.id}`}
          type="button"
          className={cn("metric-charts-section-header", folded && "is-folded")}
          aria-expanded={!folded}
          onClick={() => onToggleFold(section.id)}
        >
          <svg className="section-fold-chevron" viewBox="0 0 16 16" aria-hidden>
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="chart-prefix">{section.label}</span>
        </button>,
      );
    }
    if (!folded) {
      for (const key of section.keys) items.push(renderChart(key));
    }
    return items;
  });

  return <div className="metric-charts">{children}</div>;
}
