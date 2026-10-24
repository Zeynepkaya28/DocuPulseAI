"use client";
import { useEffect, useRef, useState } from "react";
import { useJobs, type JobView } from "@/components/shell/JobsContext";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { MiddleTruncate, Text } from "@/components/ui/Text";
import { STALL_MS, overallProgress } from "@/hooks/useIngestionStatus";
import { TYPE_SYMBOL, formatBytes } from "./docTypes";
import type { UploadItem, useUploadQueue } from "./useUploadQueue";

type Queue = ReturnType<typeof useUploadQueue>;

function useNow(active: boolean, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

interface RowState {
  value: number | null;
  label: string;
  detail?: string;
  tone: "processing" | "done" | "error" | "warning" | "rejected";
}

/** Concrete labels, e.g. "Varlıklar çıkarılıyor · 4/5" — never a vague "Yükleniyor…". // HIG: progress-indicators */
function describe(item: UploadItem, job: JobView | undefined, now: number): RowState {
  if (item.phase === "rejected") return { value: null, label: item.error ?? "Reddedildi", tone: "rejected" };
  if (item.phase === "failed") return { value: null, label: item.error ?? "Yükleme başarısız", tone: "error" };
  if (item.phase === "transferring") {
    return { value: item.transfer / 5, label: `Yükleniyor · 1/5`, detail: `%${Math.round(item.transfer * 100)} · ${formatBytes(item.size)}`, tone: "processing" };
  }
  if (!job) return { value: 0.2, label: "Sıraya alındı · 1/5", tone: "processing" };
  if (job.status === "done") return { value: 1, label: "Hazır", tone: "done" };
  if (job.status === "failed") return { value: null, label: job.error ?? "İşlem başarısız", tone: "error" };
  const stalled = job.updatedAt && now - new Date(job.updatedAt).getTime() > STALL_MS;
  if (stalled) {
    return {
      value: overallProgress(job),
      label: `${job.stageName} · ${job.stage}/5 — duraksadı`,
      detail: "90 saniyedir ilerleme yok. Kuyruk yoğun olabilir; bekleyebilir, tekrar deneyebilir veya iptal edebilirsiniz.",
      tone: "warning",
    };
  }
  return {
    value: overallProgress(job),
    label: `${job.stageName} · ${job.stage}/5`,
    detail: job.total ? `${job.progress}/${job.total}` : undefined,
    tone: "processing",
  };
}

const TONE_ICON: Record<RowState["tone"], { name: string; cls: string; sr: string }> = {
  processing: { name: "arrow.clockwise", cls: "text-status-processing", sr: "İşleniyor" },
  done: { name: "checkmark.circle", cls: "text-status-done", sr: "Tamamlandı" },
  warning: { name: "exclamationmark.triangle", cls: "text-status-warning", sr: "Uyarı" },
  error: { name: "exclamationmark.triangle", cls: "text-status-error", sr: "Hata" },
  rejected: { name: "circle.slash", cls: "text-status-error", sr: "Reddedildi" },
};

export function UploadQueue({ queue }: { queue: Queue }) {
  const { jobs } = useJobs();
  const now = useNow(queue.items.length > 0);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const last = useRef(new Map<string, string>());

  const rows = queue.items.map((item) => {
    const job = item.documentId ? jobs.find((j) => j.documentId === item.documentId) : undefined;
    return { item, job, state: describe(item, job, now) };
  });

  // Announce stage changes politely, once per change. // HIG: accessibility
  useEffect(() => {
    for (const { item, state } of rows) {
      const msg = `${item.name}: ${state.label}`;
      if (last.current.get(item.key) !== state.label) {
        last.current.set(item.key, state.label);
        setAnnounce(msg);
      }
    }
  });

  if (rows.length === 0) return <div aria-live="polite" className="sr-only">{announce}</div>;

  return (
    <section aria-label="Yükleme kuyruğu" className="mx-3 regular:mx-4 mb-4 rounded-card bg-bg-secondary overflow-hidden">
      <div aria-live="polite" className="sr-only">{announce}</div>
      <ul className="divide-y divide-separator">
        {rows.map(({ item, job, state }) => {
          const icon = TONE_ICON[state.tone];
          const inUndo = item.phase === "transferring" && now < item.undoUntil;
          const secs = Math.max(1, Math.ceil((item.undoUntil - now) / 1000));
          const canCancel = item.phase === "processing" && job && (job.status === "queued" || job.status === "running");
          return (
            <li
              key={item.key}
              className="flex items-center gap-3 px-3 py-2.5"
              // Failed drop: the item shrinks away and the reason stays readable. // HIG: drag-and-drop
              style={state.tone === "rejected" ? { animation: "dp-shrink-out 600ms var(--ease) 4s forwards" } : undefined}
              onAnimationEnd={() => state.tone === "rejected" && queue.dismiss(item.key)}
            >
              <Icon name={TYPE_SYMBOL[item.ext] ?? "doc"} scale="large" className="text-label-secondary" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-baseline gap-2">
                  <MiddleTruncate text={item.name} max={40} className="t-body text-label flex-1" />
                  {state.detail && state.tone === "processing" && (
                    <Text variant="footnote" color="secondary" className="tabular-nums">{state.detail}</Text>
                  )}
                </div>
                {(state.tone === "processing" || state.tone === "warning") && (
                  <ProgressBar value={state.value} label={`${item.name} ilerlemesi`} />
                )}
                <Text variant="footnote" color="secondary" as="p" className="flex items-center gap-1">
                  <Icon name={icon.name} scale="small" className={icon.cls} label={icon.sr} />
                  <span>{state.label}</span>
                </Text>
                {state.tone === "warning" && <Text variant="footnote" color="secondary" as="p">{state.detail}</Text>}
              </div>
              <div className="flex items-center gap-1">
                {inUndo && (
                  <Button size="small" icon="arrow.uturn.backward" onClick={() => queue.undo(item.key)}>
                    Geri Al ({secs})
                  </Button>
                )}
                {(state.tone === "error" || state.tone === "warning") && (
                  <Button size="small" icon="arrow.clockwise" onClick={() => queue.retry(item.key)}>Tekrar Dene</Button>
                )}
                {canCancel && (
                  <Button size="small" variant="plain" onClick={() => setConfirmKey(item.key)}>İptal</Button>
                )}
                {(state.tone === "done" || state.tone === "error") && (
                  <Button size="small" variant="plain" icon="xmark" iconOnly onClick={() => queue.dismiss(item.key)}>
                    Listeden kaldır
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {/* Cancelling loses progress → confirm. // HIG: progress-indicators */}
      <AlertDialog
        open={confirmKey !== null}
        title="İşlem iptal edilsin mi?"
        message="Bu dokümanın işlenmesi durur ve şimdiye kadarki ilerleme silinir."
        confirmLabel="İşlemi İptal Et"
        cancelLabel="Devam Et"
        destructive
        onCancel={() => setConfirmKey(null)}
        onConfirm={() => {
          if (confirmKey) queue.cancel(confirmKey);
          setConfirmKey(null);
        }}
      />
    </section>
  );
}
