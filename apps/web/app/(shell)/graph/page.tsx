"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { GraphEdge, GraphNode, GraphResponse } from "@docupulse/contracts";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphControls } from "@/components/graph/GraphControls";
import { GraphListFallback } from "@/components/graph/GraphListFallback";
import { NodeInspector } from "@/components/graph/NodeInspector";
import { finalForce, forceFrames, radial, type LayoutKind, type Positions } from "@/components/graph/layout";
import { useJobs } from "@/components/shell/JobsContext";
import { useShell } from "@/components/shell/ShellContext";
import { Toolbar } from "@/components/shell/Toolbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { Api } from "@/lib/api";
import type { EntityKind } from "@/lib/entityTypes";
import { useSession } from "@/lib/session";
import { useReducedMotion } from "@/lib/useMediaQuery";

const PAGE = 50; // progressive disclosure: start with the 50 best-connected nodes. // HIG: layout

function merge(a: GraphResponse, b: GraphResponse): GraphResponse {
  const nodes = new Map(a.nodes.map((n) => [n.id, n]));
  b.nodes.forEach((n) => nodes.set(n.id, { ...nodes.get(n.id), ...n }));
  const edges = new Map(a.edges.map((e) => [e.id, e]));
  b.edges.forEach((e) => edges.set(e.id, e));
  return { nodes: [...nodes.values()], edges: [...edges.values()], truncated: a.truncated || b.truncated };
}

function NodeSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full px-2.5 h-hit w-56">
      <Icon name="magnifyingglass" className="text-label-secondary" />
      <input type="search" aria-label="Düğümlerde ara" placeholder="Düğüm adına göre filtrele" value={value}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onChange("")}
        className="flex-1 min-w-0 bg-transparent outline-none t-body text-label [&::-webkit-search-cancel-button]:hidden" />
    </span>
  );
}

function GraphScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { userId, loading: sessionLoading } = useSession();
  const { isRegular } = useShell();
  const { jobs } = useJobs();
  const reduced = useReducedMotion();
  const flow = useReactFlow();

  const [data, setData] = useState<GraphResponse>({ nodes: [], edges: [], truncated: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [positions, setPositions] = useState<Positions>(new Map());
  const [layout, setLayout] = useState<LayoutKind>("force");
  const [hidden, setHidden] = useState<Set<EntityKind>>(new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("focus"));
  const [minimap, setMinimap] = useState(true);
  const [listView, setListView] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const anim = useRef<number | null>(null);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const focus = params.get("focus");
  const documentId = params.get("document");
  const collection = params.get("collection");

  useEffect(() => {
    if (sessionLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const req = focus ? Api.graph({ center: focus, depth: 1, limit }) : Api.graph({ limit, document: documentId, collection });
    req.then((r) => { setData(r); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId, sessionLoading, focus, documentId, collection, limit]);

  useEffect(() => setSelected(focus), [focus]);

  // Filter by type and live name query. // HIG: search-fields
  const view = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const nodes = data.nodes.filter((n) => !hidden.has(n.type as EntityKind) && (!q || n.name.toLocaleLowerCase("tr").includes(q)));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [data, hidden, query]);

  // Layout. Reduced motion: jump straight to the final positions, no physics animation. // HIG: accessibility
  useEffect(() => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const { nodes, edges } = { nodes: data.nodes, edges: data.edges } as { nodes: GraphNode[]; edges: GraphEdge[] };
    if (layout === "radial") {
      setPositions(radial(nodes));
      return;
    }
    if (reduced) {
      setPositions(finalForce(nodes, edges, positionsRef.current));
      return;
    }
    // Existing nodes keep their place; new ones (after "expand") settle around them.
    const frames = forceFrames(nodes, edges, positionsRef.current);
    const step = () => {
      const f = frames.next();
      if (f && !f.done) {
        setPositions(f.value);
        anim.current = requestAnimationFrame(step);
      }
    };
    anim.current = requestAnimationFrame(step);
    return () => {
      if (anim.current) cancelAnimationFrame(anim.current);
    };
  }, [data, layout, reduced]);

  useEffect(() => {
    if (data.nodes.length) {
      const t = setTimeout(() => flow.fitView({ padding: 0.25, duration: reduced ? 0 : 300 }), reduced ? 0 : 600);
      return () => clearTimeout(t);
    }
  }, [data.nodes.length, layout, flow, reduced]);

  const expand = useCallback(async (id: string) => {
    setExpanding(true);
    try {
      const more = await Api.graph({ center: id, depth: 1, limit: 30, collection });
      setData((d) => merge(d, more));
    } finally {
      setExpanding(false);
    }
  }, [collection]);

  // "Grafa yazılıyor · x/y" — determinate progress while documents are in stage 5. // HIG: progress-indicators
  const writing = jobs.filter((j) => j.stage === 5 && (j.status === "running" || j.status === "queued") && j.total);
  const wDone = writing.reduce((s, j) => s + j.progress, 0);
  const wTotal = writing.reduce((s, j) => s + (j.total ?? 0), 0);

  const empty = !loading && !error && data.nodes.length === 0;

  return (
    <div
      className="contents"
      style={{ ["--controls-bottom" as string]: isRegular ? "16px" : "calc(var(--tabbar-height) + 24px + env(safe-area-inset-bottom))" }}
    >
      <Toolbar
        title="Bilgi Grafiği"
        search={<NodeSearch value={query} onChange={setQuery} />}
        tools={
          data.truncated && !focus ? (
            <Button variant="plain" icon="plus" onClick={() => setLimit((l) => l + PAGE)}>Daha Fazla</Button>
          ) : focus || documentId ? (
            <Button variant="plain" icon="arrow.uturn.backward" onClick={() => router.replace("/graph")}>Tüm Graf</Button>
          ) : undefined
        }
      />
      {!isRegular && (
        <div className="relative z-20 px-3 pb-2">
          <Glass className="rounded-full"><NodeSearch value={query} onChange={setQuery} /></Glass>
        </div>
      )}

      {/* Canvas = content layer; full bleed beneath sidebar and toolbar. // HIG: materials, layout */}
      <div className="fixed inset-0 z-0 bg-bg">
        {listView ? (
          <GraphListFallback nodes={view.nodes} edges={view.edges} selectedId={selected} onSelect={setSelected} />
        ) : (
          <GraphCanvas nodes={view.nodes} edges={view.edges} positions={positions} selectedId={selected}
            onSelect={setSelected} showMinimap={minimap && isRegular} />
        )}

        {(loading || empty || error) && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="pointer-events-auto max-w-sm w-full px-6">
              {loading && <ProgressBar label="Graf yükleniyor" />}
              {error && <EmptyState symbol="exclamationmark.triangle" title="Graf yüklenemedi" message={error} />}
              {empty && <EmptyState symbol="point.3.connected.trianglepath.dotted" title="Graf henüz boş"
                message="Dokümanlar işlendikçe varlıklar ve ilişkiler burada görünür." />}
            </div>
          </div>
        )}

        {wTotal > 0 && (
          <Glass className="absolute left-1/2 -translate-x-1/2 top-[calc(var(--toolbar-height)+8px)] z-10 rounded-card px-3 py-2 w-72">
            <Text variant="footnote" as="p" className="mb-1 tabular-nums">
              Grafa yazılıyor · {wDone.toLocaleString("tr-TR")}/{wTotal.toLocaleString("tr-TR")} parça
            </Text>
            <ProgressBar value={wDone / wTotal} label="Grafa yazma ilerlemesi" />
          </Glass>
        )}

        <GraphControls
          layout={layout} onLayout={setLayout}
          hidden={hidden} onToggleType={(k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          minimap={minimap} onMinimap={() => setMinimap((m) => !m)}
          listView={listView} onListView={() => setListView((v) => !v)}
        />

        {selected && (
          <NodeInspector id={selected} onClose={() => setSelected(null)} onSelect={setSelected} onExpand={expand} expanding={expanding} />
        )}
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphScreen />
    </ReactFlowProvider>
  );
}
