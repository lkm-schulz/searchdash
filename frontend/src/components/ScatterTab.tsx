import { useState } from "react";
import type { Iteration, RunMeta } from "../api/types";
import type { ChartHover } from "../charts";
import { useRafCallback } from "../hooks/useRafCallback";
import ScatterPlotCard, { type ScatterCardConfig } from "./ScatterPlotCard";
import IslandToggle from "./IslandToggle";
import ViewControls from "./ViewControls";
import { EmptyState } from "./Status";

interface ScatterTabProps {
  run: RunMeta | null;
  iterations: Iteration[];
  /** All metric keys in display order (owned by the shell). */
  metricKeys: string[];
  /** Card configs to render (controlled by the shell, persists across tabs). */
  cards: ScatterCardConfig[];
  /** Append a new scatter card. */
  onAddCard: () => void;
  /** Patch a card's config by id. */
  onUpdateCard: (id: number, patch: Partial<ScatterCardConfig>) => void;
  /** Remove the scatter card with the given id. */
  onRemoveCard: (id: number) => void;
  /** Color points by island (shared with the Progress tab). */
  colorByIsland: boolean;
  /** Toggle island coloring. */
  onColorByIslandChange: (checked: boolean) => void;
}

/** Renders the shell-owned list of removable scatter-plot cards. */
export default function ScatterTab({
  run,
  iterations,
  metricKeys,
  cards,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  colorByIsland,
  onColorByIslandChange,
}: ScatterTabProps) {
  const [hover, setHover] = useState<ChartHover | null>(null);
  // Coalesce high-frequency hover events to one re-plot per frame.
  const onHover = useRafCallback(setHover);

  if (metricKeys.length === 0) {
    return <EmptyState>No metrics available.</EmptyState>;
  }

  return (
    <div className="scatter-tab">
      <ViewControls>
        <button className="btn add-plot" onClick={onAddCard}>
          + Add plot
        </button>
        <span className="preset-divider" aria-hidden />
        <IslandToggle checked={colorByIsland} onChange={onColorByIslandChange} />
      </ViewControls>
      <div className="scatter-cards">
        {cards.map((card) => (
          <ScatterPlotCard
            key={card.id}
            run={run}
            iterations={iterations}
            allKeys={metricKeys}
            card={card}
            onChange={(patch) => onUpdateCard(card.id, patch)}
            onRemove={() => onRemoveCard(card.id)}
            colorByIsland={colorByIsland}
            hover={hover}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
}
