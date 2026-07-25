import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Iteration, RunMeta } from "../api/types";
import type { ChartHover } from "../charts";
import { reorderGroups, type MetricGroup } from "../format";
import { useDatadir } from "../hooks/useDatadir";
import { useRafCallback } from "../hooks/useRafCallback";
import { iterationPath } from "../util";
import MetricCharts from "./MetricCharts";
import MetricFilter from "./MetricFilter";
import IslandToggle from "./IslandToggle";
import PillToggle from "./PillToggle";
import TotalsCard from "./TotalsCard";
import { IterationListView } from "../lists";

interface ProgressTabProps {
  run: RunMeta | null;
  iterations: Iteration[];
  /** Distinct base metric names (the single pill selection). */
  bases: string[];
  /** Metric keys grouped by prefix section (owned by the shell). */
  groups: MetricGroup[];
  /** All metric keys in drag-authored display order (drives the iteration table columns). */
  metricKeys: string[];
  /** Selected base metrics (shared with the Graph tab). */
  selectedBases: string[];
  /** Selected prefix groups (null = unprefixed "General" group). */
  selectedGroups: (string | null)[];
  /** Update the base-metric selection. */
  onBasesChange: (bases: string[]) => void;
  /** Update the prefix-group selection. */
  onGroupsChange: (groups: (string | null)[]) => void;
  /** Display order of all base metrics (drag-authored, shared with Graph + Detail). */
  basesOrder: string[];
  /** Display order of all prefix groups (drag-authored, shared with Graph + Detail). */
  groupsOrder: (string | null)[];
  onBasesOrderChange: (order: string[]) => void;
  onGroupsOrderChange: (order: (string | null)[]) => void;
  /** Effective charted full keys: present cross-product of selected bases × groups. */
  charted: string[];
  /** Color chart lines by island (shared with the Scatter tab). */
  colorByIsland: boolean;
  /** Toggle island coloring. */
  onColorByIslandChange: (checked: boolean) => void;
  /** Break charts into per-prefix sections instead of one flowing grid. */
  separateSections: boolean;
  /** Toggle per-prefix chart sections. */
  onSeparateSectionsChange: (checked: boolean) => void;
  /** Order charts base-major (`met, val.met, …`) instead of group-major. */
  interleave: boolean;
  /** Toggle interleave ordering. */
  onInterleaveChange: (checked: boolean) => void;
  /** Ids of folded chart sections (header shown, charts hidden). */
  foldedSections: string[];
  /** Toggle a section's folded state by id. */
  onToggleFold: (id: string) => void;
}

/** Charts (filtered) on top, change list below; chart clicks open the detail page. */
export default function ProgressTab({
  run,
  iterations,
  bases,
  groups,
  metricKeys,
  selectedBases,
  selectedGroups,
  onBasesChange,
  onGroupsChange,
  basesOrder,
  groupsOrder,
  onBasesOrderChange,
  onGroupsOrderChange,
  charted,
  colorByIsland,
  onColorByIslandChange,
  separateSections,
  onSeparateSectionsChange,
  interleave,
  onInterleaveChange,
  foldedSections,
  onToggleFold,
}: ProgressTabProps) {
  const navigate = useNavigate();
  const datadir = useDatadir();
  const [hover, setHover] = useState<ChartHover | null>(null);
  // Coalesce high-frequency hover events to one re-plot per frame.
  const onHover = useRafCallback(setHover);

  // Groups narrowed to the charted selection in drag-authored order, dropping
  // any that end up empty.
  const chartGroups = useMemo(() => {
    const chartedSet = new Set(charted);
    return reorderGroups(groups, groupsOrder, basesOrder)
      .map((group) => ({ prefix: group.prefix, keys: group.keys.filter((key) => chartedSet.has(key)) }))
      .filter((group) => group.keys.length > 0);
  }, [groups, charted, groupsOrder, basesOrder]);

  const handlePointClick = useCallback((id: string) => {
    navigate(iterationPath(id, datadir));
  }, [navigate, datadir]);

  return (
    <div className="progress-tab">
      <MetricFilter
        run={run}
        bases={bases}
        groups={groups}
        selectedBases={selectedBases}
        selectedGroups={selectedGroups}
        onBasesChange={onBasesChange}
        onGroupsChange={onGroupsChange}
        basesOrder={basesOrder}
        groupsOrder={groupsOrder}
        onBasesOrderChange={onBasesOrderChange}
        onGroupsOrderChange={onGroupsOrderChange}
        settings={
          <>
            <IslandToggle checked={colorByIsland} onChange={onColorByIslandChange} />
            <PillToggle checked={separateSections} onChange={onSeparateSectionsChange}>
              Separate sections
            </PillToggle>
            <PillToggle checked={interleave} onChange={onInterleaveChange}>
              Interleave
            </PillToggle>
          </>
        }
      />
      <MetricCharts
        run={run}
        iterations={iterations}
        groups={chartGroups}
        basesOrder={basesOrder}
        separateSections={separateSections}
        interleave={interleave}
        foldedSections={foldedSections}
        onToggleFold={onToggleFold}
        onPointClick={handlePointClick}
        colorByIsland={colorByIsland}
        hover={hover}
        onHover={onHover}
      />
      <TotalsCard run={run} iterations={iterations} />
      <IterationListView
        run={run}
        iterations={iterations}
        metricKeys={metricKeys}
      />
    </div>
  );
}
