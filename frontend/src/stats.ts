// Small statistics helpers, kept independent of any chart library so every
// chart implementation can reuse them.

export interface LinearFit {
  /** Slope of the least-squares line. */
  slope: number;
  /** Intercept of the least-squares line. */
  intercept: number;
  /** Coefficient of determination (r²) of the fit. */
  r2: number;
}

/**
 * Ordinary least-squares fit of y on x. Returns null when there are fewer than
 * two points or x has no variance (a vertical line is not expressible as y=mx+b).
 */
export function linearRegression(points: Array<{ x: number; y: number }>): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denomX = n * sumXX - sumX * sumX;
  if (denomX === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denomX;
  const intercept = (sumY - slope * sumX) / n;

  const denomY = n * sumYY - sumY * sumY;
  const r = denomY === 0 ? 1 : (n * sumXY - sumX * sumY) / Math.sqrt(denomX * denomY);
  return { slope, intercept, r2: r * r };
}

/** A 2D point used by the frontier geometry helpers. */
export interface Point {
  x: number;
  y: number;
}

/** Frontier line and its dominated-region polygon, ready to plot. */
export interface FrontierGeometry {
  /** Staircase polyline through the frontier points (ascending x). */
  line: Point[];
  /** Closed polygon covering the dominated region (frontier → worst corner). */
  region: Point[];
}

/**
 * Pareto frontier of a 2D point set, returned sorted by ascending x so the
 * caller can connect them as a single line. A point is on the frontier when no
 * other point dominates it — i.e. is at least as good on both axes and strictly
 * better on at least one. "Good" follows each axis's preferred direction:
 * `xHigherIsBetter`/`yHigherIsBetter` flip whether larger or smaller wins.
 */
export function paretoFrontier(points: Point[], xHigherIsBetter: boolean, yHigherIsBetter: boolean): Point[] {
  // Map each axis to a maximization sign so domination is a single comparison.
  const signX = xHigherIsBetter ? 1 : -1;
  const signY = yHigherIsBetter ? 1 : -1;
  const dominates = (a: Point, b: Point) =>
    signX * a.x >= signX * b.x && signY * a.y >= signY * b.y && (signX * a.x > signX * b.x || signY * a.y > signY * b.y);

  const frontier = points.filter((candidate) => !points.some((other) => dominates(other, candidate)));
  return frontier.sort((a, b) => a.x - b.x);
}

/**
 * Frontier rendering geometry that is correct for any combination of axis
 * directions. The frontier is drawn as a staircase (the achievable envelope:
 * between two frontier points only the jointly-worse corner is reachable, so a
 * diagonal would wrongly claim the gap). The dominated region is that same
 * staircase closed onto the worst-on-both corner of the data extremes, so the
 * shaded area extends out to every point dominated by the frontier.
 *
 * Returns null when no frontier point exists.
 */
export function paretoFrontierGeometry(points: Point[], xHigherIsBetter: boolean, yHigherIsBetter: boolean): FrontierGeometry | null {
  const frontier = paretoFrontier(points, xHigherIsBetter, yHigherIsBetter);
  if (frontier.length === 0) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const worstX = xHigherIsBetter ? Math.min(...xs) : Math.max(...xs);
  const worstY = yHigherIsBetter ? Math.min(...ys) : Math.max(...ys);

  // Walk the chain from its worst-x endpoint so the first vertex sits on the
  // vertical worst-x edge and the last on the horizontal worst-y edge.
  const chain = xHigherIsBetter ? frontier : [...frontier].reverse();
  const innerCorner = (a: Point, b: Point): Point => ({
    x: xHigherIsBetter ? Math.min(a.x, b.x) : Math.max(a.x, b.x),
    y: yHigherIsBetter ? Math.min(a.y, b.y) : Math.max(a.y, b.y),
  });

  const line: Point[] = [];
  for (let i = 0; i < chain.length; i++) {
    line.push(chain[i]);
    if (i < chain.length - 1) line.push(innerCorner(chain[i], chain[i + 1]));
  }

  const start = chain[0];
  const end = chain[chain.length - 1];
  const region: Point[] = [{ x: worstX, y: start.y }, ...line, { x: end.x, y: worstY }, { x: worstX, y: worstY }];
  return { line, region };
}
