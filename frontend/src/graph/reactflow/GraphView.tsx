import { useMemo } from "react";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import type { GraphViewProps } from "../types";
import { islandColor } from "../../islandColor";

const NODE_WIDTH = 176;
const HEADER_HEIGHT = 22;
const METRIC_ROW_HEIGHT = 16;
const VERTICAL_PADDING = 10;
const RANK_GAP = 72;

/** Pixel height of a node given how many metric rows it shows. */
function nodeHeight(metricCount: number): number {
  return HEADER_HEIGHT + metricCount * METRIC_ROW_HEIGHT + VERTICAL_PADDING;
}

/**
 * React Flow implementation of the graph contract. Dagre packs nodes
 * horizontally within each rank; the vertical rank is pinned to the node's
 * `generation` so layout depth always matches parent-chain depth. Each node
 * shows its id plus the caller-selected metric rows. Only `parent` edges feed
 * the layout; `inspiration` edges are a dashed overlay gated by
 * `showInspirations`. Edges with an endpoint missing from the node set are
 * dropped.
 */
export default function GraphView({ nodes, edges, showInspirations, onNodeClick }: GraphViewProps) {
  const present = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

  const { rfNodes, rfEdges } = useMemo(() => {
    const maxMetrics = nodes.reduce((max, node) => Math.max(max, node.metrics.length), 0);
    const rankHeight = nodeHeight(maxMetrics) + RANK_GAP;

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: "TB", nodesep: 36, ranksep: RANK_GAP });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const node of nodes) {
      graph.setNode(node.id, { width: NODE_WIDTH, height: nodeHeight(node.metrics.length) });
    }
    for (const edge of edges) {
      if (edge.kind === "parent" && present.has(edge.source) && present.has(edge.target)) {
        graph.setEdge(edge.source, edge.target);
      }
    }
    dagre.layout(graph);

    const rfNodes: Node[] = nodes.map((node) => {
      const laidOut = graph.node(node.id);
      const height = nodeHeight(node.metrics.length);
      return {
        id: node.id,
        position: { x: laidOut.x - NODE_WIDTH / 2, y: node.generation * rankHeight },
        data: {
          label: (
            <div className="graph-node">
              <div className="graph-node-id">{node.label}</div>
              {node.metrics.map((metric) => (
                <div key={metric.label} className="graph-node-metric">
                  <span className="graph-node-metric-label">{metric.label}</span>
                  <span className="graph-node-metric-value">{metric.value}</span>
                </div>
              ))}
            </div>
          ),
        },
        style: {
          width: NODE_WIDTH,
          height,
          background: islandColor(node.island),
          color: "#16161e",
          border: "1px solid var(--border-strong)",
          borderRadius: 8,
          padding: 0,
        },
      };
    });

    const visible = showInspirations ? edges : edges.filter((edge) => edge.kind === "parent");
    const rfEdges: Edge[] = visible
      .filter((edge) => present.has(edge.source) && present.has(edge.target))
      .map((edge) => ({
        id: `${edge.kind}:${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        style:
          edge.kind === "inspiration"
            ? { stroke: "var(--text-muted)", strokeDasharray: "6 4", strokeOpacity: 0.6 }
            : { stroke: "var(--border-strong)" },
      }));

    return { rfNodes, rfEdges };
  }, [nodes, edges, showInspirations, present]);

  return (
    <div className="graph-view">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
