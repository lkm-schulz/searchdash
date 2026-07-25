// Shared island-grouping helpers for the chart views. Both the line and scatter
// charts split their points per island; the string-token Set keys null and
// numeric ids uniformly while preserving first-seen island order.

/** Group points by island, preserving first-seen island order. */
export function groupByIsland<T extends { island: number | null }>(
  points: T[],
): Array<{ island: number | null; points: T[] }> {
  const groups = new Map<string, { island: number | null; points: T[] }>();
  for (const point of points) {
    const token = String(point.island);
    const group = groups.get(token) ?? { island: point.island, points: [] };
    group.points.push(point);
    groups.set(token, group);
  }
  return [...groups.values()];
}

/** Distinct islands in first-seen order. */
export function distinctIslands(points: Array<{ island: number | null }>): Array<number | null> {
  return groupByIsland(points).map((group) => group.island);
}
