// Shared cross-chart hover-link overlay, used by both the line and scatter
// views. Hovering a point in one chart highlights the same iteration in its
// linked siblings: a filled marker over the point (shown on every chart so the
// hovered point reads the same everywhere) plus a value card on the passive
// charts (the source chart shows its own native tooltip instead).

import type { Annotations, Data, PlotMouseEvent } from "plotly.js";
import type { ChartTheme } from "./useChartTheme";
import type { ChartHover } from "../types";

/** Iteration id carried in a point's customdata (always the first tuple slot). */
export function pointId(event: PlotMouseEvent): string | undefined {
  const customdata = event.points?.[0]?.customdata as unknown;
  return Array.isArray(customdata) ? (customdata[0] as string) : undefined;
}

/** The hovered iteration's point in this chart's data, or undefined. */
export function hoveredPoint<T extends { id: string }>(points: T[], hover: ChartHover | null | undefined): T | undefined {
  return hover ? points.find((point) => point.id === hover.id) : undefined;
}

/** Filled marker drawn over the hovered point so its center reads solid. */
export function highlightMarker(x: number, y: number, color: string, surface: string): Data {
  return {
    type: "scatter",
    mode: "markers",
    x: [x],
    y: [y],
    marker: { color, size: 11, line: { color: surface, width: 2 } },
    hoverinfo: "skip",
    showlegend: false,
  };
}

/** Fractional position of `value` within `range` (0.5 when range is degenerate). */
export function fraction(value: number, range: [number, number] | undefined): number {
  if (!range || range[1] === range[0]) return 0.5;
  return (value - range[0]) / (range[1] - range[0]);
}

/** Options shaping a value card. */
export interface ValueCardOptions {
  /** Anchor x in data coords. */
  x: number;
  /** Anchor y in data coords. */
  y: number;
  /** Card text (value or label). */
  text: string;
  /** Border / arrow color (island or accent). */
  color: string;
  /** Active theme. */
  theme: ChartTheme;
  /** Anchor's fractional x position, for edge-aware horizontal placement. */
  xFraction: number;
  /** Anchor's fractional y position, for top-band vertical flipping. */
  yFraction: number;
}

/**
 * Borderless-arrow value card anchored to a point, nudged so it stays inside
 * the plot: below the point when it sits in the top band, toward the center
 * when it sits near a horizontal edge.
 */
export function valueCard({ x, y, text, color, theme, xFraction, yFraction }: ValueCardOptions): Partial<Annotations> {
  return {
    x,
    y,
    text,
    showarrow: false,
    yshift: yFraction > 0.8 ? -18 : 18,
    xshift: xFraction > 0.85 ? -32 : xFraction < 0.15 ? 32 : 0,
    bgcolor: theme.surface,
    bordercolor: color,
    borderwidth: 1,
    borderpad: 4,
    font: { color: theme.text, size: 11 },
  };
}
