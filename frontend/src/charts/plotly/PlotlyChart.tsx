// Thin React wrapper over Plotly.js (deliberately not react-plotly.js, so we own
// event wiring, theme-driven re-renders, and listener cleanup). Both chart views
// render through this single component.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Plotly from "plotly.js-basic-dist-min";
import type { Config, Data, Layout, PlotMouseEvent, PlotRelayoutEvent, PlotlyHTMLElement } from "plotly.js";
import { getZoom, setZoom } from "./zoomStore";
import type { AxisZoom } from "./zoomStore";
import { count, timed } from "./perfLog";

/** Props for the shared Plotly wrapper. */
export interface PlotlyChartProps {
  /** Plotly traces. */
  data: Data[];
  /** Plotly layout (already themed by the caller). */
  layout: Partial<Layout>;
  /** Plotly config (interaction flags). */
  config: Partial<Config>;
  /** Stable id under which zoom/pan persists across unmounts (e.g. tab switches). */
  viewId: string;
  /** Fired on `plotly_click` with the raw point event. */
  onPointClick?: (event: PlotMouseEvent) => void;
  /** Fired on `plotly_hover` with the raw point event. */
  onHover?: (event: PlotMouseEvent) => void;
  /** Fired on `plotly_unhover`. */
  onUnhover?: () => void;
  /** Container style override. */
  style?: CSSProperties;
}

/** Overlay any stored axis ranges onto a freshly-built layout. */
function withStoredZoom(layout: Partial<Layout>, viewId: string): Partial<Layout> {
  const stored = getZoom(viewId);
  if (!stored) return layout;
  const apply = (axis: Partial<Layout["xaxis"]> | undefined, zoom: AxisZoom | undefined) =>
    zoom ? { ...axis, ...(zoom.autorange ? { autorange: true } : { range: zoom.range, autorange: false }) } : axis;
  return { ...layout, xaxis: apply(layout.xaxis, stored.xaxis), yaxis: apply(layout.yaxis, stored.yaxis) };
}

/** Capture the axis ranges from a relayout event into the zoom store. */
function captureZoom(viewId: string, event: PlotRelayoutEvent): void {
  const raw = event as Record<string, number | boolean | undefined>;
  const axisFrom = (key: "xaxis" | "yaxis"): AxisZoom | undefined => {
    if (raw[`${key}.autorange`]) return { autorange: true };
    const lo = raw[`${key}.range[0]`];
    const hi = raw[`${key}.range[1]`];
    if (typeof lo === "number" && typeof hi === "number") return { range: [lo, hi], autorange: false };
    return undefined;
  };
  const x = axisFrom("xaxis");
  const y = axisFrom("yaxis");
  if (!x && !y) return;
  const cur = getZoom(viewId) ?? {};
  setZoom(viewId, { xaxis: x ?? cur.xaxis, yaxis: y ?? cur.yaxis });
}

/** Render and keep a Plotly graph in sync with React props. */
export default function PlotlyChart({
  data,
  layout,
  config,
  viewId,
  onPointClick,
  onHover,
  onUnhover,
  style,
}: PlotlyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Container width Plotly last drew at; the resize transform scales against it.
  const plottedWidth = useRef(0);

  // Whether the chart is on (or near) screen. A cross-chart hover re-renders every
  // sibling; gating the re-plot on visibility means off-screen charts skip the
  // expensive Plotly.react and only catch up when scrolled back into view — the
  // difference between a snappy and a janky dashboard once many charts are mounted.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[entries.length - 1].isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(div);
    return () => observer.disconnect();
  }, []);

  // Re-plot on any data/layout/config change, restoring any zoom persisted for
  // this view (e.g. set before a tab switch unmounted the chart). Plotly.react
  // diffs internally and reuses the same graph div (and its event emitter).
  // Skipped while off-screen; becoming visible re-runs this with the latest props.
  useEffect(() => {
    const div = ref.current;
    if (!div || !visible) return;
    void timed("Plotly.react", () => Plotly.react(div, data, withStoredZoom(layout, viewId), config));
  }, [data, layout, config, viewId, visible]);

  // Attach event listeners separately so they only re-bind when a handler
  // identity changes, not on every re-plot. The emitter survives Plotly.react.
  useEffect(() => {
    const div = ref.current as PlotlyHTMLElement | null;
    if (!div || typeof div.on !== "function") return;
    const onRelayout = (event: PlotRelayoutEvent) => captureZoom(viewId, event);
    div.on("plotly_relayout", onRelayout);
    if (onPointClick) div.on("plotly_click", onPointClick);
    if (onHover) div.on("plotly_hover", onHover);
    if (onUnhover) div.on("plotly_unhover", onUnhover);
    return () => {
      div.removeAllListeners?.("plotly_relayout");
      div.removeAllListeners?.("plotly_click");
      div.removeAllListeners?.("plotly_hover");
      div.removeAllListeners?.("plotly_unhover");
    };
  }, [viewId, onPointClick, onHover, onUnhover]);

  // Keep the graph sized to its container. Plotly's own `responsive` only listens
  // to window `resize`, so it misses container-driven reflows (auto-fill grid
  // column-count jumps, panel/scrollbar toggles). A full `Plotly.Plots.resize` is
  // a relayout — too heavy to run every frame of a fast drag, which is what makes
  // the plot trail the container step-wise. So we split it: during the drag we
  // only apply a cheap GPU `scaleX` transform so the existing SVG fills the
  // container with zero lag, then debounce one real relayout once movement
  // settles to restore crisp geometry. The observed div's layout box is unaffected
  // by its own transform, so the scale ratio stays correct across frames.
  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    div.style.transformOrigin = "0 0";
    let settle = 0;
    const snap = () => {
      const width = div.offsetWidth;
      // Redraw at the true width first, then drop the scale transform in the
      // resolve microtask — the new SVG is already in the DOM by then, so the
      // browser never paints the old-width SVG unscaled (which flickered).
      timed("Plotly.resize", () => Plotly.Plots.resize(div));
      div.style.transform = "";
      plottedWidth.current = width;
    };
    plottedWidth.current = div.offsetWidth;
    const observer = new ResizeObserver(() => {
      const width = div.offsetWidth;
      if (plottedWidth.current > 0 && width > 0) {
        div.style.transform = `scaleX(${width / plottedWidth.current})`;
      }
      clearTimeout(settle);
      settle = window.setTimeout(snap, 120);
    });
    observer.observe(div);
    return () => {
      clearTimeout(settle);
      observer.disconnect();
    };
  }, []);

  // Purge the graph (and its listeners) once on unmount.
  useEffect(() => {
    count("chart mount");
    const div = ref.current;
    return () => {
      count("chart unmount");
      if (div) timed("Plotly.purge", () => Plotly.purge(div));
    };
  }, []);

  return <div ref={ref} style={{ width: "100%", ...style }} />;
}
