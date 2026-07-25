import { useCallback, useMemo } from "react";
import type { Data, Layout, PlotMouseEvent } from "plotly.js";
import type { LineChartProps, LinePoint } from "../types";
import { groupByIsland } from "../islands";
import { islandColor } from "../../islandColor";
import { useChartTheme } from "./useChartTheme";
import { baseConfig, baseLayout, extremeLines, paddedRange } from "./layout";
import { fraction, highlightMarker, hoveredPoint, pointId, valueCard } from "./hoverLink";
import PlotlyChart from "./PlotlyChart";

/** Per-point customdata tuple: [id, label, formatted value]. */
type PointMeta = [string, string, string];

/** Build a single Plotly line trace for a set of points in one color. */
function lineTrace(points: LinePoint[], color: string, surface: string, fmt: (value: number) => string): Data {
  return {
    type: "scatter",
    mode: "lines+markers",
    x: points.map((point) => point.x),
    y: points.map((point) => point.y),
    customdata: points.map((point): PointMeta => [point.id, point.label, point.y === null ? "" : fmt(point.y)]),
    connectgaps: true,
    line: { color, width: 2 },
    marker: { color: surface, size: 6, line: { color, width: 2 } },
    hovertemplate: "%{customdata[1]}<br>%{customdata[2]}<extra></extra>",
    hoverlabel: { bordercolor: color },
  };
}

/** Plotly implementation of the line-chart contract. */
export default function LineChartView({
  points,
  title,
  prefix,
  chartId,
  onPointClick,
  formatValue,
  colorByIsland,
  hover,
  onHover,
}: LineChartProps) {
  const theme = useChartTheme();
  const fmt = useMemo(() => formatValue ?? ((value: number) => String(value)), [formatValue]);

  // The hovered iteration's point in this chart (driving chart included, so its
  // center fills like the linked charts'); the value card is shown only on the
  // passive charts, since the driving chart already has its native tooltip.
  const hovered = hoveredPoint(points, hover);
  const highlight = hovered && hovered.y !== null ? hovered : undefined;
  const highlightColor = highlight && colorByIsland ? islandColor(highlight.island) : theme.accent;
  const showCard = highlight && hover?.source !== chartId;

  // The per-point line traces are the expensive part; build them independently
  // of hover so a sibling-hover re-render reuses the same trace objects instead
  // of re-mapping every point. Hover then only appends a 1-point marker.
  const baseTraces = useMemo<Data[]>(
    () =>
      colorByIsland
        ? groupByIsland(points).map((group) => lineTrace(group.points, islandColor(group.island), theme.surface, fmt))
        : [lineTrace(points, theme.accent, theme.surface, fmt)],
    [points, colorByIsland, theme.surface, theme.accent, fmt],
  );

  const data = useMemo<Data[]>(() => {
    if (highlight && highlight.y !== null) {
      return [...baseTraces, highlightMarker(highlight.x, highlight.y, highlightColor, theme.surface)];
    }
    return baseTraces;
  }, [baseTraces, highlight, highlightColor, theme.surface]);

  const layout = useMemo<Partial<Layout>>(() => {
    const values = points.map((point) => point.y).filter((y): y is number => y !== null);
    const yRange = paddedRange(values);
    const xRange = paddedRange(points.map((point) => point.x), 0.02);
    const base = baseLayout(theme, { height: 220 });
    return {
      ...base,
      // X-axis = chronological iteration index (1-based, set at the data
      // source). Native `tickmode: "auto"` + `tickformat: "d"` lets Plotly
      // place integer ticks for the visible window and recompute them on zoom
      // without a React re-render. `automargin: false` + pinned bottom margin
      // keeps the plot box stable across hover-triggered relayouts.
      margin: { ...base.margin, b: 32 },
      shapes: extremeLines(values, theme),
      xaxis: {
        ...base.xaxis,
        automargin: false,
        tickmode: "auto",
        nticks: 10,
        tickformat: "d",
        range: xRange,
        autorange: false,
      },
      yaxis: { ...base.yaxis, range: yRange, autorange: false },
      annotations:
        showCard && highlight && highlight.y !== null
          ? [
              valueCard({
                x: highlight.x,
                y: highlight.y,
                text: fmt(highlight.y),
                color: highlightColor,
                theme,
                xFraction: fraction(highlight.x, xRange),
                yFraction: fraction(highlight.y, yRange),
              }),
            ]
          : undefined,
    };
  }, [points, theme, showCard, highlight, highlightColor, fmt]);

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
    <div className="chart-card">
      <div className="chart-title">
        {prefix && <span className="chart-prefix">{prefix}</span>}
        {title}
      </div>
      <PlotlyChart
        data={data}
        layout={layout}
        config={baseConfig}
        viewId={`line:${chartId}`}
        onPointClick={onPointClick ? handleClick : undefined}
        onHover={onHover ? handleHover : undefined}
        onUnhover={onHover ? handleUnhover : undefined}
      />
    </div>
  );
}
