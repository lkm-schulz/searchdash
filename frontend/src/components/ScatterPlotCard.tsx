import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ScatterChartView } from "../charts";
import type { ChartHover, ScatterPoint } from "../charts";
import type { Iteration, RunMeta } from "../api/types";
import { metricLabel, metricMeta } from "../format";
import { iterationPath } from "../util";
import { useDatadir } from "../hooks/useDatadir";
import PillToggle from "./PillToggle";

/** Persisted configuration of a single scatter card (owned by the shell). */
export interface ScatterCardConfig {
  id: number;
  xKey: string;
  yKey: string;
  showFit: boolean;
  showFrontier: boolean;
}

interface ScatterPlotCardProps {
  run: RunMeta | null;
  iterations: Iteration[];
  allKeys: string[];
  card: ScatterCardConfig;
  /** Patch this card's config (axis choice, fit toggle). */
  onChange: (patch: Partial<ScatterCardConfig>) => void;
  onRemove: () => void;
  /** Color points by island (shared across the Scatter tab). */
  colorByIsland: boolean;
  /** Iteration hovered across the linked scatter cards (null when none). */
  hover: ChartHover | null;
  /** Report this card's hovered iteration to the linked-card group. */
  onHover: (hover: ChartHover | null) => void;
}

/** One ad-hoc scatter: pick x/y metrics; points clickable through to detail. */
export default function ScatterPlotCard({ run, iterations, allKeys, card, onChange, onRemove, colorByIsland, hover, onHover }: ScatterPlotCardProps) {
  const navigate = useNavigate();
  const datadir = useDatadir();
  const { xKey, yKey, showFit, showFrontier } = card;
  const xHigherIsBetter = metricMeta(run, xKey)?.higherIsBetter ?? true;
  const yHigherIsBetter = metricMeta(run, yKey)?.higherIsBetter ?? true;

  // Memoized so a hover-driven re-render reuses the same array identity rather
  // than rebuilding it, keeping the chart's static traces stable across hovers.
  const points: ScatterPoint[] = useMemo(
    () =>
      iterations
        .filter((it) => xKey in it.metrics && yKey in it.metrics)
        .map((it) => ({ id: it.id, x: it.metrics[xKey], y: it.metrics[yKey], label: it.id, island: it.island ?? null })),
    [iterations, xKey, yKey],
  );

  const select = (value: string, onSelect: (v: string) => void) => (
    <select value={value} onChange={(e) => onSelect(e.target.value)}>
      {allKeys.map((key) => (
        <option key={key} value={key}>
          {metricLabel(run, key)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="scatter-card">
      <div className="scatter-card-controls">
        <div className="scatter-card-axes">
          <label>x: {select(xKey, (v) => onChange({ xKey: v }))}</label>
          <label>y: {select(yKey, (v) => onChange({ yKey: v }))}</label>
        </div>
        <div className="scatter-card-actions">
          <PillToggle checked={showFit} onChange={(v) => onChange({ showFit: v })}>
            Fit
          </PillToggle>
          <PillToggle checked={showFrontier} onChange={(v) => onChange({ showFrontier: v })}>
            Frontier
          </PillToggle>
          <button className="btn remove" onClick={onRemove} aria-label="Remove plot" title="Remove plot">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <ScatterChartView
        points={points}
        xLabel={metricLabel(run, xKey)}
        yLabel={metricLabel(run, yKey)}
        chartId={String(card.id)}
        showFit={showFit}
        showFrontier={showFrontier}
        xHigherIsBetter={xHigherIsBetter}
        yHigherIsBetter={yHigherIsBetter}
        colorByIsland={colorByIsland}
        hover={hover}
        onHover={onHover}
        onPointClick={(id) => navigate(iterationPath(id, datadir))}
      />
    </div>
  );
}
