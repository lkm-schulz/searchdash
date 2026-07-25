// Shared Plotly layout/config builders for the chart views. Centralizes the
// ClearML-style drag interactions (zoom dragmode, axis pan/scale, double-click
// reset) and the theme-driven coloring so both views stay DRY.

import type { Config, Layout, Shape } from "plotly.js";
import type { ChartTheme } from "./useChartTheme";
import { minMax } from "../../format";

/**
 * Drag-only interaction config shared by every chart: no mode bar, no scroll
 * zoom, double-click resets to autorange. `dragmode: "zoom"` is set in the
 * layout so click-drag draws an axis-locked / box window. Resizing is handled by
 * a ResizeObserver in PlotlyChart (covers container reflows the built-in
 * `responsive` window listener misses), so `responsive` is intentionally unset.
 */
export const baseConfig: Partial<Config> = {
  displayModeBar: false,
  scrollZoom: false,
  doubleClick: "reset",
};

/** Options shaping the base layout. */
export interface BaseLayoutOptions {
  /** Fixed plot height in pixels. */
  height: number;
}

/**
 * Themed base layout: surface-colored paper/plot, muted ticks, faint grid, and
 * the ClearML drag behavior (`dragmode: "zoom"` + draggable axes via the
 * default `fixedrange: false`).
 */
export function baseLayout(theme: ChartTheme, { height }: BaseLayoutOptions): Partial<Layout> {
  const axis: Partial<Layout["xaxis"]> = {
    gridcolor: theme.grid,
    zeroline: false,
    linecolor: theme.grid,
    tickfont: { color: theme.textMuted, size: 11 },
    automargin: true,
  };
  return {
    height,
    dragmode: "zoom",
    // Stable token: Plotly preserves user zoom/pan across Plotly.react re-plots
    // (e.g. when a sibling hover re-renders this chart) as long as it is unchanged.
    uirevision: "chart",
    paper_bgcolor: theme.surface,
    plot_bgcolor: theme.surface,
    font: { color: theme.text },
    margin: { t: 8, r: 8, b: 8, l: 8 },
    showlegend: false,
    // Pin the tick angle so a hover-triggered relayout can't flip labels into
    // auto-rotation (which shifts the plot box and cascades across linked charts).
    xaxis: { ...axis, tickangle: 0 },
    yaxis: { ...axis },
    hoverlabel: {
      bgcolor: theme.surface,
      bordercolor: theme.border,
      font: { color: theme.text },
    },
  };
}

/**
 * Dashed horizontal guides at the min and max of `values` (faint, muted). The
 * max guide is dropped when it coincides with the min (flat series).
 */
export function extremeLines(values: number[], theme: ChartTheme): Partial<Shape>[] {
  const extremes = minMax(values);
  if (!extremes) return [];
  const line = (y: number): Partial<Shape> => ({
    type: "line",
    xref: "paper",
    x0: 0,
    x1: 1,
    yref: "y",
    y0: y,
    y1: y,
    line: { color: theme.textMuted, width: 1, dash: "dash" },
    opacity: 0.45,
    layer: "below",
  });
  const shapes = [line(extremes.min)];
  if (extremes.max !== extremes.min) shapes.push(line(extremes.max));
  return shapes;
}

/**
 * Range covering `values` with autorange-style padding, or `undefined` when
 * empty. Pinning the y-axis to the data range (autorange off) keeps overlay
 * annotations — drawn above the topmost point — from expanding the axis, which
 * would otherwise make the chart jump on hover.
 */
export function paddedRange(values: number[], frac = 0.06): [number, number] | undefined {
  const extremes = minMax(values);
  if (!extremes) return undefined;
  const span = extremes.max - extremes.min;
  const pad = span === 0 ? Math.abs(extremes.min) * 0.1 || 1 : span * frac;
  return [extremes.min - pad, extremes.max + pad];
}
