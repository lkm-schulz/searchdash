import { useCallback, useMemo } from "react";
import type { Data, Layout, PlotMouseEvent } from "plotly.js";
import type { ScatterChartProps, ScatterPoint } from "../types";
import { groupByIsland } from "../islands";
import { islandColor } from "../../islandColor";
import { linearRegression, paretoFrontierGeometry } from "../../stats";
import { minMax } from "../../format";
import { useChartTheme } from "./useChartTheme";
import { baseConfig, baseLayout, paddedRange } from "./layout";
import { fraction, highlightMarker, hoveredPoint, pointId, valueCard } from "./hoverLink";
import PlotlyChart from "./PlotlyChart";

/** Per-point customdata tuple: [id, label]. */
type PointMeta = [string, string];

/** Build a single Plotly marker trace for a set of points in one color. */
function markerTrace(points: ScatterPoint[], color: string): Data {
  return {
    type: "scatter",
    mode: "markers",
    x: points.map((point) => point.x),
    y: points.map((point) => point.y),
    customdata: points.map((point): PointMeta => [point.id, point.label]),
    marker: { color, size: 8 },
    hovertemplate: "%{customdata[1]}<br>%{x}, %{y}<extra></extra>",
    hoverlabel: { bordercolor: color },
  };
}

/** Plotly implementation of the scatter-chart contract. */
export default function ScatterChartView({
  points,
  xLabel,
  yLabel,
  chartId,
  onPointClick,
  showFit,
  showFrontier,
  xHigherIsBetter = true,
  yHigherIsBetter = true,
  colorByIsland,
  hover,
  onHover,
}: ScatterChartProps) {
  const theme = useChartTheme();
  const fit = useMemo(() => (showFit ? linearRegression(points) : null), [showFit, points]);
  const frontier = useMemo(
    () => (showFrontier ? paretoFrontierGeometry(points, xHigherIsBetter, yHigherIsBetter) : null),
    [showFrontier, points, xHigherIsBetter, yHigherIsBetter],
  );

  // The hovered iteration's point in this chart (driving chart included, so its
  // center reads the same everywhere); the value card shows only on the passive
  // charts, since the driving chart already has its native tooltip.
  const highlight = hoveredPoint(points, hover);
  const highlightColor = highlight && colorByIsland ? islandColor(highlight.island) : theme.accent;
  const showCard = highlight && hover?.source !== chartId;

  // The per-point marker traces (+ optional fit line) are the expensive part;
  // build them independently of hover so a sibling-hover re-render reuses the
  // same trace objects instead of re-mapping every point. Hover then only
  // appends a 1-point marker.
  const baseTraces = useMemo<Data[]>(() => {
    const traces = colorByIsland
      ? groupByIsland(points).map((group) => markerTrace(group.points, islandColor(group.island)))
      : [markerTrace(points, theme.accent)];
    const xExtremes = minMax(points.map((point) => point.x));
    if (fit && xExtremes) {
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [xExtremes.min, xExtremes.max],
        y: [fit.slope * xExtremes.min + fit.intercept, fit.slope * xExtremes.max + fit.intercept],
        line: { color: theme.accent2, width: 2, dash: "dash" },
        hoverinfo: "skip",
      });
    }
    // Frontier staircase + shaded dominated region, prepended so markers stay
    // on top. The shaded polygon ends at the worst-on-both corner, so it covers
    // exactly the points the frontier dominates.
    if (frontier) {
      const fill: Data = {
        type: "scatter",
        mode: "lines",
        x: frontier.region.map((point) => point.x),
        y: frontier.region.map((point) => point.y),
        line: { color: "transparent", width: 0 },
        fill: "toself",
        fillcolor: `${theme.frontier}22`,
        hoverinfo: "skip",
      };
      const line: Data = {
        type: "scatter",
        mode: "lines",
        x: frontier.line.map((point) => point.x),
        y: frontier.line.map((point) => point.y),
        line: { color: theme.frontier, width: 2 },
        hoverinfo: "skip",
      };
      traces.unshift(fill, line);
    }
    return traces;
  }, [points, colorByIsland, theme.accent, theme.accent2, theme.frontier, fit, frontier]);

  const data = useMemo<Data[]>(
    () => (highlight ? [...baseTraces, highlightMarker(highlight.x, highlight.y, highlightColor, theme.surface)] : baseTraces),
    [baseTraces, highlight, highlightColor, theme.surface],
  );

  const layout = useMemo<Partial<Layout>>(() => {
    const xRange = paddedRange(points.map((point) => point.x));
    const yRange = paddedRange(points.map((point) => point.y));
    const base = baseLayout(theme, { height: 320 });
    const fitNote: Partial<Layout>["annotations"] = fit
      ? [
          {
            xref: "paper",
            yref: "paper",
            x: 1,
            y: 1,
            xanchor: "right",
            yanchor: "top",
            text: `r² = ${fit.r2.toFixed(3)}`,
            showarrow: false,
            font: { color: theme.textMuted, size: 11 },
          },
        ]
      : [];
    const card = showCard && highlight
      ? [
          valueCard({
            x: highlight.x,
            y: highlight.y,
            text: highlight.label,
            color: highlightColor,
            theme,
            xFraction: fraction(highlight.x, xRange),
            yFraction: fraction(highlight.y, yRange),
          }),
        ]
      : [];
    return {
      ...base,
      margin: { t: 16, r: 24, b: 44, l: 56 },
      xaxis: { ...base.xaxis, range: xRange, autorange: false, title: { text: xLabel, font: { color: theme.textMuted, size: 12 } } },
      yaxis: { ...base.yaxis, range: yRange, autorange: false, title: { text: yLabel, font: { color: theme.textMuted, size: 12 } } },
      annotations: [...fitNote, ...card],
    };
  }, [points, theme, xLabel, yLabel, fit, showCard, highlight, highlightColor]);

  const handleClick = useCallback(
    (event: PlotMouseEvent) => {
      const id = pointId(event);
      if (id && onPointClick) onPointClick(id);
    },
    [onPointClick],
  );

  const handleHover = useCallback(
    (event: PlotMouseEvent) => {
      if (!onHover) return;
      const id = pointId(event);
      if (id) onHover({ id, source: chartId });
    },
    [onHover, chartId],
  );

  const handleUnhover = useCallback(() => {
    if (onHover && hover?.source === chartId) onHover(null);
  }, [onHover, hover, chartId]);

  return (
    <PlotlyChart
      data={data}
      layout={layout}
      config={baseConfig}
      viewId={`scatter:${chartId}:${xLabel}:${yLabel}`}
      onPointClick={onPointClick ? handleClick : undefined}
      onHover={onHover ? handleHover : undefined}
      onUnhover={onHover ? handleUnhover : undefined}
    />
  );
}
