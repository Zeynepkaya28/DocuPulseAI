"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";
import { useJobs } from "@/components/shell/JobsContext";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { overallProgress } from "@/hooks/useIngestionStatus";
import { Api, type DocumentDetail as Detail } from "@/lib/api";
import { entityStyle } from "@/lib/entityTypes";
import { TYPE_LABEL, formatBytes } from "./docTypes";
import { StatusLabel, formatDate } from "./StatusLabel";

/** Detail pane: summary, metadata, extracted entities and "Grafta göster". Full text lives here, not in rows. // HIG: lists-and-tables */
export function DocumentDetail({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const [doc, setDoc] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { collections } = useShell();
  const { jobs } = useJobs();
  const router = useRouter();
  const job = jobs.find((j) => j.documentId === id);

  useEffect(() => {
    let alive = true;
    setDoc(null);
    Api.document(id).then((d) => alive && setDoc(d)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, job?.status]);

  if (error) {
    return (
      <Text variant="body" color="secondary" as="p" className="p-6 flex items-center gap-2">
        <Icon name="exclamationmark.triangle" className="text-status-error" />{error}
      </Text>
    );
  }
  if (!doc) return <div className="p-6"><ProgressBar label="Doküman yükleniyor" /></div>;

  const processing = job && (job.status === "running" || job.status === "queued");

  return (
    <article className="p-5 space-y-5" aria-labelledby="doc-title">
      <header className="space-y-1">
        <Text id="doc-title" variant="title2" emphasized as="h2" className="break-words">{doc.title}</Text>
        <Text variant="callout" color="secondary" as="p">
          <StatusLabel doc={doc} job={job} />
        </Text>
        {processing && job && (
          <div className="pt-2 space-y-1">
            <ProgressBar value={overallProgress(job)} label="İşlem ilerlemesi" />
            <Text variant="footnote" color="secondary" as="p">{job.stageName} · {job.stage}/5</Text>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant="prominent" icon="point.3.connected.trianglepath.dotted" disabled={doc.status !== "ready"}
          onClick={() => router.push(`/graph?document=${doc.id}`)}>
          Grafta Göster
        </Button>
        <Button icon="bubble.left.and.text.bubble.right" disabled={doc.status !== "ready"}
          onClick={() => router.push(`/chat?q=${encodeURIComponent(`"${doc.title}" dokümanını özetle`)}`)}>
          Sor
        </Button>
      </div>

      {doc.summary && (
        <section className="space-y-1">
          <Text variant="headline" as="h3">Özet</Text>
          <Text variant="body" as="p" className="leading-relaxed">{doc.summary}</Text>
        </section>
      )}

      <section>
        <Text variant="headline" as="h3" className="mb-1">Bilgiler</Text>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 t-body">
          <dt className="text-label-secondary">Tür</dt><dd>{TYPE_LABEL[doc.mime] ?? doc.mime}</dd>
          <dt className="text-label-secondary">Yazar</dt><dd>{doc.author ?? "—"}</dd>
          <dt className="text-label-secondary">Tarih</dt><dd>{formatDate(doc.published_at ?? doc.created_at)}</dd>
          <dt className="text-label-secondary">Boyut</dt><dd>{doc.size_bytes ? formatBytes(doc.size_bytes) : "—"}</dd>
          <dt className="text-label-secondary">Parça</dt><dd className="tabular-nums">{doc.chunk_count}</dd>
          <dt className="text-label-secondary">Koleksiyon</dt>
          <dd>
            <label className="sr-only" htmlFor="move-collection">Koleksiyona taşı</label>
            <select
              id="move-collection"
              value={doc.collection_id ?? ""}
              onChange={async (e) => {
                const updated = await Api.updateDocument(doc.id, { collection_id: e.target.value || null });
                setDoc({ ...doc, collection_id: updated.collection_id });
              }}
              className="hit rounded-control bg-fill-tertiary px-2 t-body text-label"
            >
              <option value="">Koleksiyon yok</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </dd>
        </dl>
      </section>

      <section>
        <Text variant="headline" as="h3" className="mb-2">Varlıklar ({doc.entities.length})</Text>
        {doc.entities.length === 0 ? (
          <Text variant="callout" color="secondary" as="p">Henüz varlık çıkarılmadı.</Text>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {doc.entities.map((e) => {
              const st = entityStyle(e.type);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/graph?focus=${encodeURIComponent(e.id)}`)}
                    className="hit inline-flex items-center gap-1 rounded-full bg-fill-tertiary px-2.5 t-callout text-label"
                  >
                    <Icon name={st.symbol} scale="small" style={{ color: `rgb(var(--c-${st.color}))` }} />
                    <span>{e.name}</span>
                    <span className="sr-only">({st.label})</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pt-2">
        <Button variant="destructive" icon="trash" onClick={() => setConfirmDelete(true)}>Dokümanı Sil</Button>
      </section>
      <AlertDialog
        open={confirmDelete}
        title={`"${doc.title}" silinsin mi?`}
        message="Doküman, parçaları ve graftaki ilişkileri kalıcı olarak silinir. Bu işlem geri alınamaz."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await Api.deleteDocument(doc.id);
          onDeleted?.();
        }}
      />
    </article>
  );
}
