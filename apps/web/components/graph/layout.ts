import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";
import type { GraphEdge, GraphNode } from "@docupulse/contracts";
import { ENTITY_KINDS } from "@/lib/entityTypes";

export type LayoutKind = "force" | "radial";
export type Positions = Map<string, { x: number; y: number }>;

interface SimNode extends SimulationNodeDatum { id: string }

/**
 * Force layout. Returns a generator of frames so callers can animate, or just take the last frame
 * when reduced motion is on ("settle into the final position without animation"). // HIG: accessibility
 */
export function* forceFrames(nodes: GraphNode[], edges: GraphEdge[], prev: Positions, ticks = 220, every = 6) {
  const sim = forceSimulation<SimNode>(
    nodes.map((n, i) => {
      const p = prev.get(n.id);
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return { id: n.id, x: p?.x ?? Math.cos(a) * 200, y: p?.y ?? Math.sin(a) * 200 };
    }),
  )
    .force("link", forceLink<SimNode, { source: string; target: string }>(edges.map((e) => ({ source: e.source, target: e.target }))).id((d) => d.id).distance(130).strength(0.6))
    .force("charge", forceManyBody().strength(-420))
    .force("collide", forceCollide(48))
    .force("center", forceCenter(0, 0))
    .stop();

  for (let t = 1; t <= ticks; t++) {
    sim.tick();
    if (t % every === 0 || t === ticks) {
      yield new Map(sim.nodes().map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])) as Positions;
    }
  }
}

export function finalForce(nodes: GraphNode[], edges: GraphEdge[], prev: Positions): Positions {
  let last: Positions = new Map();
  for (const f of forceFrames(nodes, edges, prev)) last = f;
  return last;
}

/** Rings by entity type; most-connected nodes first on each ring. */
export function radial(nodes: GraphNode[]): Positions {
  const out: Positions = new Map();
  ENTITY_KINDS.forEach((kind, ring) => {
    const group = nodes.filter((n) => n.type === kind).sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0));
    const r = 140 + ring * 120;
    group.forEach((n, i) => {
      const a = (i / Math.max(1, group.length)) * Math.PI * 2 + ring * 0.4;
      out.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    });
  });
  return out;
}
