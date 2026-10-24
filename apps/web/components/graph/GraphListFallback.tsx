"use client";
import type { GraphEdge, GraphNode } from "@docupulse/contracts";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { entityStyle } from "@/lib/entityTypes";
import { EntityShape } from "./EntityShape";

/** Screen-reader-friendly alternative to the canvas: entity table + relation table. // HIG: accessibility */
export function GraphListFallback({ nodes, edges, selectedId, onSelect }: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const name = new Map(nodes.map((n) => [n.id, n.name]));
  const sorted = [...nodes].sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0));
  return (
    <div className="absolute inset-0 overflow-auto pt-toolbar pb-24 px-4">
      <div className="max-w-4xl mx-auto grid gap-6 regular:grid-cols-2">
        <section>
          <Text variant="title3" emphasized as="h2" className="mb-2">Varlıklar ({nodes.length})</Text>
          <table className="w-full t-body">
            <thead>
              <tr className="text-left t-subheadline text-label-secondary border-b border-separator">
                <th scope="col" className="py-1 pr-2">Ad</th>
                <th scope="col" className="py-1 pr-2">Tür</th>
                <th scope="col" className="py-1 text-right">İlişki</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((n, i) => (
                <tr key={n.id} aria-selected={n.id === selectedId} className={n.id === selectedId ? "bg-accent/15" : i % 2 ? "bg-bg-secondary" : ""}>
                  <td className="py-1 pr-2">
                    <button type="button" onClick={() => onSelect(n.id)} className="hit inline-flex items-center gap-2 text-left text-label">
                      <EntityShape type={n.type} size={18} />{n.name}
                    </button>
                  </td>
                  <td className="py-1 pr-2 text-label-secondary">{entityStyle(n.type).label}</td>
                  <td className="py-1 text-right tabular-nums">{n.degree ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <Text variant="title3" emphasized as="h2" className="mb-2">İlişkiler ({edges.length})</Text>
          <table className="w-full t-body">
            <thead>
              <tr className="text-left t-subheadline text-label-secondary border-b border-separator">
                <th scope="col" className="py-1 pr-2">Kaynak</th>
                <th scope="col" className="py-1 pr-2">İlişki</th>
                <th scope="col" className="py-1">Hedef</th>
              </tr>
            </thead>
            <tbody>
              {edges.map((e, i) => (
                <tr key={e.id} className={i % 2 ? "bg-bg-secondary" : ""}>
                  <td className="py-1 pr-2">{name.get(e.source) ?? e.source}</td>
                  <td className="py-1 pr-2 text-label-secondary">
                    <span className="inline-flex items-center gap-1">
                      {e.conflict && <Icon name="exclamationmark.triangle" scale="small" className="text-status-warning" label="Çelişkili" />}
                      {e.type}
                    </span>
                  </td>
                  <td className="py-1">{name.get(e.target) ?? e.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
