"use client";
import "@xyflow/react/dist/base.css";
import { memo, useMemo, type KeyboardEvent } from "react";
import {
  BaseEdge, EdgeLabelRenderer, Handle, MiniMap, Position, ReactFlow, getStraightPath, useReactFlow, useStore,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from "@xyflow/react";
import type { GraphEdge, GraphNode } from "@docupulse/contracts";
import { Icon } from "@/components/ui/Icon";
import { entityStyle } from "@/lib/entityTypes";
import { EntityShape } from "./EntityShape";
import type { Positions } from "./layout";

type EntityData = { node: GraphNode; dim: boolean; selected: boolean };
type RelData = { type: string; conflict: boolean; dim: boolean };

const zoomSel = (s: { transform: [number, number, number] }) => s.transform[2];

/** Labels ≥10pt; when zoomed out they are hidden instead of being shown clipped. // HIG: typography */
const EntityNode = memo(function EntityNode({ data }: NodeProps<Node<EntityData>>) {
  const zoom = useStore(zoomSel);
  const { node, dim, selected } = data;
  const st = entityStyle(node.type);
  return (
    <div
      className="flex flex-col items-center gap-1 w-[140px] transition-opacity duration-fast"
      style={{ opacity: dim ? 0.22 : 1 }}
      aria-label={`${node.name}, ${st.label}${node.degree ? `, ${node.degree} ilişki` : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1 !min-w-0 !min-h-0 !border-0" style={{ top: 18 }} />
      <span
        className="rounded-full p-[3px]"
        // Persistent selection ring. // HIG: sidebars, lists-and-tables (selection stays visible)
        style={{ boxShadow: selected ? "0 0 0 3px rgb(var(--accent))" : undefined }}
      >
        <EntityShape type={node.type} size={36} />
      </span>
      {zoom >= 0.55 && (
        <span className="t-caption1 text-label text-center leading-tight px-1 rounded material-thick [overflow-wrap:anywhere]">
          {node.name}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1 !min-w-0 !min-h-0 !border-0" style={{ top: 18 }} />
    </div>
  );
});

/** Edge label = relation name (caption1, secondaryLabel). Conflicting relation: dashed + orange warning symbol. // HIG: color */
function RelEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<RelData>>) {
  const zoom = useStore(zoomSel);
  const [path, lx, ly] = getStraightPath({ sourceX, sourceY: sourceY - 18, targetX, targetY: targetY - 18 });
  const conflict = data?.conflict;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: conflict ? "rgb(var(--status-warning))" : "var(--tertiary-label)",
          strokeWidth: conflict ? 2 : 1.25,
          strokeDasharray: conflict ? "6 4" : undefined,
          opacity: data?.dim ? 0.15 : 1,
        }}
      />
      {zoom >= 0.8 && data && !data.dim && (
        <EdgeLabelRenderer>
          <span
            className="absolute pointer-events-none t-caption1 text-label-secondary material-thick rounded px-1 inline-flex items-center gap-0.5"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            {conflict && <Icon name="exclamationmark.triangle" scale="small" className="text-status-warning" label="Çelişkili ilişki" />}
            {data.type}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { entity: EntityNode };
const edgeTypes = { rel: RelEdge };

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  positions: Positions;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showMinimap: boolean;
}

export function GraphCanvas({ nodes, edges, positions, selectedId, onSelect, showMinimap }: Props) {
  const flow = useReactFlow();

  // Selected node stays highlighted; unrelated nodes fade. // HIG: layout
  const neighbors = useMemo(() => {
    if (!selectedId) return null;
    const s = new Set([selectedId]);
    edges.forEach((e) => {
      if (e.source === selectedId) s.add(e.target);
      if (e.target === selectedId) s.add(e.source);
    });
    return s;
  }, [edges, selectedId]);

  const rfNodes: Node<EntityData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "entity",
        position: { x: (positions.get(n.id)?.x ?? 0) - 70, y: (positions.get(n.id)?.y ?? 0) - 18 },
        data: { node: n, dim: !!neighbors && !neighbors.has(n.id), selected: n.id === selectedId },
        selected: n.id === selectedId,
        ariaLabel: n.name,
      })),
    [nodes, positions, neighbors, selectedId],
  );

  const rfEdges: Edge<RelData>[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "rel",
        data: { type: e.type, conflict: !!e.conflict, dim: !!neighbors && !(neighbors.has(e.source) && neighbors.has(e.target)) },
      })),
    [edges, neighbors],
  );

  // Keyboard: arrows pan, +/- zoom, Enter selects the focused node, Esc clears. // HIG: accessibility
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const vp = flow.getViewport();
    const step = 60;
    const pan: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (pan[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      flow.setViewport({ ...vp, x: vp.x + pan[e.key][0], y: vp.y + pan[e.key][1] });
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      flow.zoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      flow.zoomOut();
    } else if (e.key === "Enter") {
      const id = (document.activeElement as HTMLElement | null)?.closest(".react-flow__node")?.getAttribute("data-id");
      if (id) {
        e.preventDefault();
        onSelect(id);
      }
    } else if (e.key === "Escape") {
      onSelect(null);
    }
  };

  return (
    <div className="absolute inset-0" onKeyDownCapture={onKey}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable
        edgesFocusable={false}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        aria-label="Bilgi grafiği. Düğümler arasında Tab ile gezinin, Enter ile seçin, ok tuşlarıyla kaydırın, + ve - ile yakınlaştırın."
      >
        {showMinimap && (
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            className="!glass !rounded-card !m-3"
            nodeColor={(n) => `rgb(var(--c-${entityStyle((n.data as EntityData).node.type).color}))`}
            maskColor="var(--glass-dim)"
            ariaLabel="Mini harita"
            style={{ bottom: "var(--minimap-offset, 0px)" }}
          />
        )}
      </ReactFlow>
    </div>
  );
}
