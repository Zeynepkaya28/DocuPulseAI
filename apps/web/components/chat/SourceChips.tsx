"use client";
import { useRouter } from "next/navigation";
import type { RelationPath } from "@docupulse/contracts";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import type { Sources } from "@/hooks/useStreamingAnswer";

export function pathLabel(p: RelationPath): string {
  const names = new Map(p.nodes.map((n) => [n.id, n.name]));
  // Walk the chain in order so "X —geliştirdi→ Y —yan etkisi→ Z" reads left to right.
  let out = "";
  p.edges.forEach((e, i) => {
    const s = names.get(e.source) ?? e.source;
    const t = names.get(e.target) ?? e.target;
    out += i === 0 ? `${s} —${e.type}→ ${t}` : ` —${e.type}→ ${t}`;
  });
  return out;
}

/**
 * Two source groups under every answer:
 *  (1) "Pasajlar" from vector search (text.quote), (2) "İlişki zinciri" from the graph.
 * Clicking a chain focuses that node in the Knowledge Graph. Conflicts: orange triangle + text,
 * never color alone. // HIG: color, accessibility
 */
export function SourceChips({ sources, onPassage }: { sources: Sources; onPassage?: (chunkId: string) => void }) {
  const router = useRouter();
  const { passages, paths, conflicts } = sources;
  if (!passages.length && !paths.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {conflicts.length > 0 && (
        <div role="note" className="flex items-start gap-1.5 rounded-control bg-fill-tertiary px-2.5 py-1.5">
          <Icon name="exclamationmark.triangle" className="text-status-warning mt-0.5" />
          <div>
            <Text variant="callout" emphasized as="p">Kaynaklar çelişiyor</Text>
            {conflicts.map((c) => (
              <Text key={c.subject + c.relation} variant="footnote" color="secondary" as="p">
                {c.subject} · {c.relation}: {c.values.join(" / ")}
              </Text>
            ))}
          </div>
        </div>
      )}

      {passages.length > 0 && (
        <section aria-label="Pasajlar">
          <Text variant="footnote" emphasized color="secondary" as="h4" className="mb-1">Pasajlar</Text>
          <ul className="flex flex-wrap gap-1.5">
            {passages.map((p, i) => (
              <li key={p.chunk_id}>
                <button
                  type="button"
                  onClick={() => onPassage?.(p.chunk_id)}
                  title={p.snippet.slice(0, 240)}
                  className="hit inline-flex items-center gap-1 rounded-full bg-fill-tertiary px-2.5 t-footnote text-label max-w-[18rem]"
                >
                  <Icon name="text.quote" scale="small" className="text-accent" />
                  <span className="text-label-secondary">P{i + 1}</span>
                  <span className="truncate">{p.document_title}</span>
                  {p.page ? <span className="text-label-secondary whitespace-nowrap">s. {p.page}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paths.length > 0 && (
        <section aria-label="İlişki zinciri">
          <Text variant="footnote" emphasized color="secondary" as="h4" className="mb-1">İlişki zinciri</Text>
          <ul className="flex flex-wrap gap-1.5">
            {paths.map((p, i) => {
              const target = p.nodes[p.nodes.length - 1]?.id ?? p.nodes[0]?.id;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => router.push(`/graph?focus=${encodeURIComponent(target)}`)}
                    aria-label={`R${i + 1}: ${pathLabel(p)}. Grafta göster`}
                    className="hit inline-flex items-center gap-1 rounded-full bg-fill-tertiary px-2.5 t-footnote text-label text-left"
                  >
                    <Icon name="point.3.connected.trianglepath.dotted" scale="small" className="text-accent" />
                    <span className="text-label-secondary">R{i + 1}</span>
                    <span>{pathLabel(p)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
