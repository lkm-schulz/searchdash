// Shared island → color mapping. Used by the graph nodes and the island-colored
// chart series so a given island reads the same color everywhere.

/** Categorical fills cycled by island index. */
export const ISLAND_PALETTE = [
  "#6ea8fe",
  "#f0a76f",
  "#4ec98a",
  "#f0726f",
  "#b98cf0",
  "#5fc8d8",
  "#e6c454",
  "#e87fb0",
  "#86b35a",
  "#8a8af0",
];

/** Fill used when an iteration has no recorded island. */
export const NULL_ISLAND_COLOR = "#9a9aac";

/** Stable color for an island, cycling the palette; null → neutral gray. */
export function islandColor(island: number | null): string {
  if (island == null) return NULL_ISLAND_COLOR;
  const index = ((island % ISLAND_PALETTE.length) + ISLAND_PALETTE.length) % ISLAND_PALETTE.length;
  return ISLAND_PALETTE[index];
}
