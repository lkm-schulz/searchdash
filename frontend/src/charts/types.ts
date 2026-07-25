// Chart-adapter contract. The dashboard imports ONLY these prop types and the
// components re-exported from ./index — no recharts (or any other library) type
// ever escapes the charts/ folder. Swap libraries by adding charts/<lib>/ and
// flipping the re-export in charts/index.ts.

export interface LinePoint {
  /** Stable iteration id this point belongs to (used for click-through). */
  id: string;
  /** X position (iteration order index). */
  x: number;
  /** Y value (the metric); null renders a gap. */
  y: number | null;
  /** Label shown on the x-axis / tooltip. */
  label: string;
  /** Island the iteration belongs to; drives per-island coloring when enabled. */
  island: number | null;
}

/** Shared hover state linking sibling line charts so they highlight in lockstep. */
export interface ChartHover {
  /** Iteration id hovered across the linked charts. */
  id: string;
  /** chartId of the originating chart; suppresses its own duplicate popup. */
  source: string;
}

export interface LineChartProps {
  /** Series points in x order. */
  points: LinePoint[];
  /** Title rendered above the chart. */
  title: string;
  /** Section prefix shown as a small tag before the title; null/absent shows none. */
  prefix?: string | null;
  /** Stable identity for this chart, used to mark the hover source. */
  chartId: string;
  /** Fired with the iteration id when a point is clicked. */
  onPointClick?: (id: string) => void;
  /** Optional value formatter for axis ticks and tooltips. */
  formatValue?: (value: number) => string;
  /** Split into one colored line per island instead of a single series. */
  colorByIsland?: boolean;
  /** Iteration hovered across the linked charts (null when none). */
  hover?: ChartHover | null;
  /** Report this chart's hovered iteration to the linked-chart group. */
  onHover?: (hover: ChartHover | null) => void;
}

export interface ScatterPoint {
  /** Stable iteration id this point belongs to (used for click-through). */
  id: string;
  /** X metric value. */
  x: number;
  /** Y metric value. */
  y: number;
  /** Label shown in the tooltip. */
  label: string;
  /** Island the iteration belongs to; drives per-island coloring when enabled. */
  island: number | null;
}

export interface ScatterChartProps {
  /** Points to plot. */
  points: ScatterPoint[];
  /** X-axis (metric) label. */
  xLabel: string;
  /** Y-axis (metric) label. */
  yLabel: string;
  /** Stable identity for this chart, used to mark the hover source. */
  chartId: string;
  /** Fired with the iteration id when a point is clicked. */
  onPointClick?: (id: string) => void;
  /** Overlay a linear least-squares fit line (with r²) when true. */
  showFit?: boolean;
  /** Overlay the Pareto frontier (line + shaded dominated region) when true. */
  showFrontier?: boolean;
  /** Whether larger x is better; drives frontier orientation. Defaults to true. */
  xHigherIsBetter?: boolean;
  /** Whether larger y is better; drives frontier orientation. Defaults to true. */
  yHigherIsBetter?: boolean;
  /** Color points by island instead of a single series color. */
  colorByIsland?: boolean;
  /** Iteration hovered across the linked scatter charts (null when none). */
  hover?: ChartHover | null;
  /** Report this chart's hovered iteration to the linked-chart group. */
  onHover?: (hover: ChartHover | null) => void;
}
