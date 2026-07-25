// Reads the concrete chart colors from the active theme's CSS custom properties
// and re-reads them whenever the theme toggles, so Plotly layouts (which need
// real color strings, not `var(--x)` references) recolor live.

import { useEffect, useState } from "react";

/** Concrete colors a Plotly layout needs, resolved from CSS custom properties. */
export interface ChartTheme {
  /** Plot and paper background. */
  surface: string;
  /** Secondary surface (cards, hover labels). */
  surface2: string;
  /** Border / outline color. */
  border: string;
  /** Primary text color. */
  text: string;
  /** Muted text color (ticks, axis labels). */
  textMuted: string;
  /** Primary accent (single-series lines, fit annotations). */
  accent: string;
  /** Secondary accent (fit line). */
  accent2: string;
  /** Frontier accent (Pareto frontier line + dominated-region fill). */
  frontier: string;
  /** Grid line color. */
  grid: string;
}

const TOKEN_BY_KEY: Record<keyof ChartTheme, string> = {
  surface: "--surface",
  surface2: "--surface-2",
  border: "--border",
  text: "--text",
  textMuted: "--text-muted",
  accent: "--accent",
  accent2: "--accent-2",
  frontier: "--good",
  grid: "--chart-grid",
};

/** Read every theme token off the document root at the current theme. */
function readTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement);
  const read = (token: string) => style.getPropertyValue(token).trim();
  return {
    surface: read(TOKEN_BY_KEY.surface),
    surface2: read(TOKEN_BY_KEY.surface2),
    border: read(TOKEN_BY_KEY.border),
    text: read(TOKEN_BY_KEY.text),
    textMuted: read(TOKEN_BY_KEY.textMuted),
    accent: read(TOKEN_BY_KEY.accent),
    accent2: read(TOKEN_BY_KEY.accent2),
    frontier: read(TOKEN_BY_KEY.frontier),
    grid: read(TOKEN_BY_KEY.grid),
  };
}

/**
 * Resolve the chart theme and re-resolve it whenever the `data-theme` attribute
 * on the document root changes, triggering a re-render so Plotly recolors live.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
