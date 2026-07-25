// Graph-adapter contract. The dashboard imports ONLY these prop types and the
// component re-exported from ./index — no @xyflow/react (or dagre) type ever
// escapes the graph/ folder. Swap libraries by adding graph/<lib>/ and flipping
// the re-export in graph/index.ts. Mirrors the charts/ seam.

/** A single pre-formatted metric row rendered on a node. */
export interface GraphNodeMetric {
  /** Human-facing metric label. */
  label: string;
  /** Already-formatted metric value. */
  value: string;
}

export interface GraphNode {
  /** Stable iteration id (used for click-through and edge endpoints). */
  id: string;
  /** Text rendered on the node (the iteration id). */
  label: string;
  /** Parent-chain depth (roots 0); drives the layout rank. */
  generation: number;
  /** Island this iteration belongs to; null renders a neutral fill. */
  island: number | null;
  /** Metric rows rendered on the node, in display order. */
  metrics: GraphNodeMetric[];
}

export type GraphEdgeKind = "parent" | "inspiration";

export interface GraphEdge {
  /** Source iteration id. */
  source: string;
  /** Target (child) iteration id. */
  target: string;
  /** Lineage (`parent`, solid) vs LLM `inspiration` (dashed). */
  kind: GraphEdgeKind;
}

export interface GraphViewProps {
  /** Nodes to render. */
  nodes: GraphNode[];
  /** Edges to render; only `parent` edges affect layout ranking. */
  edges: GraphEdge[];
  /** Render the dashed `inspiration` edges when true (they are dense). */
  showInspirations: boolean;
  /** Fired with the iteration id when a node is clicked. */
  onNodeClick?: (id: string) => void;
}
