// Library-agnostic helper: derive each iteration's generation (parent-chain
// depth) from the parent DAG alone. Inspiration edges are ignored. A root — no
// parent, or a parent absent from the set — is generation 0.

import type { Iteration } from "../api/types";
import { iterationsById } from "../format";

/**
 * Compute the generation of every iteration: `parent.generation + 1`, with
 * roots at 0. Memoized over the parent chain and cycle-safe (a back-edge into a
 * node already being resolved is treated as a root rather than recursing).
 */
export function computeGenerations(iterations: Iteration[]): Map<string, number> {
  const byId = iterationsById(iterations);
  const generations = new Map<string, number>();
  const resolving = new Set<string>();

  const depth = (id: string): number => {
    const cached = generations.get(id);
    if (cached !== undefined) return cached;
    const iteration = byId.get(id);
    const parent = iteration?.parent;
    if (!iteration || parent == null || !byId.has(parent) || resolving.has(id)) {
      generations.set(id, 0);
      return 0;
    }
    resolving.add(id);
    const generation = depth(parent) + 1;
    resolving.delete(id);
    generations.set(id, generation);
    return generation;
  };

  for (const iteration of iterations) depth(iteration.id);
  return generations;
}
