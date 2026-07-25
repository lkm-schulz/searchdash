// Active chart implementation. To swap libraries, point these re-exports at a
// different charts/<lib>/ folder; nothing else in the app changes.

export { default as LineChartView } from "./plotly/LineChartView";
export { default as ScatterChartView } from "./plotly/ScatterChartView";
export type { ChartHover, LineChartProps, LinePoint, ScatterChartProps, ScatterPoint } from "./types";
