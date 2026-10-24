"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { Api, type EntityDetail } from "@/lib/api";
import { entityStyle } from "@/lib/entityTypes";
import { EntityShape } from "./EntityShape";

interface Props {
  id: string;
  onClose: () => void;
  onExpand: (id: string) => void;
  onSelect: (id: string) => void;
  expanding: boolean;
}

/** Inspector for the selected node (control layer → regular glass, text heavy). // HIG: materials, layout */
export function NodeInspector({ id, onClose, onExpand, onSelect, expanding }: Props) {
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    Api.entity(id).then((d) => alive && setDetail(d)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <Glass
      as="aside"
      aria-label="Varlık ayrıntıları"
      className="absolute z-20 right-3 top-[calc(var(--toolbar-height)+4px)] bottom-3 w-[min(340px,calc(100vw-1.5rem))] rounded-sheet overflow-auto"
      style={{ bottom: "var(--controls-bottom, 12px)" }}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          {detail && <EntityShape type={detail.type} size={40} />}
          <div className="flex-1 min-w-0">
            <Text variant="title3" emphasized as="h2" className="break-words">{detail?.name ?? "…"}</Text>
            {detail && <Text variant="footnote" color="secondary" as="p">{entityStyle(detail.type).label}</Text>}
          </div>
          <Button variant="plain" icon="xmark" iconOnly onClick={onClose}>Ayrıntıları kapat</Button>
        </div>

        {error && (
          <Text variant="callout" as="p" className="flex items-center gap-1">
            <Icon name="exclamationmark.triangle" className="text-status-error" />{error}
          </Text>
        )}
        {!detail && !error && <ProgressBar label="Varlık yükleniyor" />}

        {detail && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="prominent" icon="bubble.left.and.text.bubble.right"
                onClick={() => router.push(`/chat?entity=${encodeURIComponent(detail.name)}`)}>
                Bu Varlık Hakkında Sor
              </Button>
              <Button icon="plus" disabled={expanding} onClick={() => onExpand(id)}>Komşuları Genişlet</Button>
            </div>

            {detail.aliases.length > 0 && (
              <Text variant="callout" color="secondary" as="p">Diğer adlar: {detail.aliases.join(", ")}</Text>
            )}

            <section>
              <Text variant="headline" as="h3" className="mb-1">Geçtiği Dokümanlar ({detail.documents.length})</Text>
              <ul className="space-y-0.5">
                {detail.documents.map((d) => (
                  <li key={d.id}>
                    <Link href={`/library?doc=${d.id}`} className="hit flex items-center gap-2 px-1 rounded-control t-body text-label no-underline hover:bg-fill-tertiary">
                      <Icon name="doc.text" className="text-accent" />
                      <span className="truncate">{d.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <Text variant="headline" as="h3" className="mb-1">İlişkiler ({detail.relations.length})</Text>
              <ul className="space-y-0.5">
                {detail.relations.map((r, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => onSelect(r.other_id)}
                      className="hit w-full flex items-center gap-1.5 px-1 rounded-control t-callout text-left hover:bg-fill-tertiary">
                      {r.conflict && <Icon name="exclamationmark.triangle" scale="small" className="text-status-warning" label="Çelişkili" />}
                      <span className="text-label-secondary whitespace-nowrap">{r.direction === "out" ? `—${r.type}→` : `←${r.type}—`}</span>
                      <span className="truncate">{r.other_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </Glass>
  );
}
