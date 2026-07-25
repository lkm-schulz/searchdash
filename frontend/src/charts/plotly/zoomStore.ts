// Module-level store of per-chart zoom/pan state, keyed by a stable view id.
// `uirevision` preserves interactions only while a graph stays mounted; tab
// switches unmount (and purge) the charts, so we persist the axis ranges here
// and restore them when the chart remounts.

/** Persisted state of one axis: an explicit range, or autorange (reset). */
export interface AxisZoom {
  /** Manual [min, max] range; absent when autoranged. */
  range?: [number, number];
  /** True when the axis is autoranged (e.g. after a double-click reset). */
  autorange?: boolean;
}

/** Persisted zoom of a single chart. */
export interface ChartZoom {
  xaxis?: AxisZoom;
  yaxis?: AxisZoom;
}

const store = new Map<string, ChartZoom>();

/** Stored zoom for `viewId`, or undefined when the chart was never zoomed. */
export function getZoom(viewId: string): ChartZoom | undefined {
  return store.get(viewId);
}

/** Persist `zoom` for `viewId`. */
export function setZoom(viewId: string, zoom: ChartZoom): void {
  store.set(viewId, zoom);
}
