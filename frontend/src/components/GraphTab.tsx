import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Iteration, RunMeta } from "../api/types";
import { formatMetric, metricLabel, metricMeta, type MetricGroup } from "../format";
import { iterationPath } from "../util";
import { useDatadir } from "../hooks/useDatadir";
import MetricFilter from "./MetricFilter";
import PillToggle from "./PillToggle";
import { EmptyState } from "./Status";
import { computeGenerations } from "../graph/generation";
import { GraphView, type GraphEdge, type GraphNode } from "../graph";

interface GraphTabProps {
  run: RunMeta | null;
  iterations: Iteration[];
  /** Distinct base metric names (the single pill selection). */
  bases: string[];
  /** Metric keys grouped by prefix section (owned by the shell). */
  groups: MetricGroup[];
  /** Selected base metrics (shared with the Progress tab). */
  selectedBases: string[];
  /** Selected prefix groups (null = unprefixed "General" group). */
  selectedGroups: (string | null)[];
  /** Update the base-metric selection. */
  onBasesChange: (bases: string[]) => void;
  /** Update the prefix-group selection. */
  onGroupsChange: (groups: (string | null)[]) => void;
  /** Display order of all base metrics (drag-authored, shared across pages). */
  basesOrder: string[];
  /** Display order of all prefix groups (drag-authored, shared across pages). */
  groupsOrder: (string | null)[];
  onBasesOrderChange: (order: string[]) => void;
  onGroupsOrderChange: (order: (string | null)[]) => void;
  /** Effective metrics shown on each node: present cross-product of bases × groups. */
  charted: string[];
  /** Whether dashed inspiration edges are shown (persisted by the shell). */
  showInspirations: boolean;
  /** Toggle inspiration edges. */
  onShowInspirationsChange: (checked: boolean) => void;
}

/**
 * Renders the iteration DAG: parent lineage as solid edges, LLM inspirations as
 * a toggleable dashed overlay, nodes colored by island. Each node shows the
 * shell-selected metrics (the same selection the Progress tab drives, via the
 * reused MetricFilter). Builds the library-agnostic node/edge contract from the
 * loaded iterations and hands it to the swappable GraphView. Node click
 * navigates to the iteration detail page.
 */
export default function GraphTab({
  run,
  iterations,
  bases,
  groups,
  selectedBases,
  selectedGroups,
  onBasesChange,
  onGroupsChange,
  basesOrder,
  groupsOrder,
  onBasesOrderChange,
  onGroupsOrderChange,
  charted,
  showInspirations,
  onShowInspirationsChange,
}: GraphTabProps) {
  const navigate = useNavigate();
  const datadir = useDatadir();

  const { nodes, edges } = useMemo(() => {
    const generations = computeGenerations(iterations);

    const nodes: GraphNode[] = iterations.map((iteration) => ({
      id: iteration.id,
      label: iteration.id,
      generation: generations.get(iteration.id) ?? 0,
      island: iteration.island ?? null,
      metrics: charted.map((key) => ({
        label: metricLabel(run, key),
        value: key in iteration.metrics ? formatMetric(iteration.metrics[key], metricMeta(run, key)) : "—",
      })),
    }));

    const edges: GraphEdge[] = [];
    for (const iteration of iterations) {
      if (iteration.parent != null) {
        edges.push({ source: iteration.parent, target: iteration.id, kind: "parent" });
      }
      for (const inspiration of iteration.inspirations ?? []) {
        edges.push({ source: inspiration, target: iteration.id, kind: "inspiration" });
      }
    }

    return { nodes, edges };
  }, [run, iterations, charted]);

  if (iterations.length === 0) {
    return <EmptyState>No iterations to graph.</EmptyState>;
  }

  return (
    <div className="graph-tab">
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
          <PillToggle checked={showInspirations} onChange={onShowInspirationsChange}>
            Show inspiration edges
          </PillToggle>
        }
      />
      <GraphView
        nodes={nodes}
        edges={edges}
        showInspirations={showInspirations}
        onNodeClick={(id) => navigate(iterationPath(id, datadir))}
      />
    </div>
  );
}
