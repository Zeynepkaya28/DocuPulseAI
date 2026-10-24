"use client";
import type { Document } from "@docupulse/contracts";
import type { JobView } from "@/components/shell/JobsContext";
import { Icon } from "@/components/ui/Icon";

export interface StatusInfo {
  symbol: string;
  cls: string;
  text: string;
}

/** Status = icon + text + color, never color alone. One color, one meaning. // HIG: color, accessibility */
export function statusInfo(doc: Pick<Document, "status">, job?: JobView): StatusInfo {
  if (job && (job.status === "running" || job.status === "queued") && doc.status !== "ready") {
    return { symbol: "arrow.clockwise", cls: "text-status-processing", text: `İşleniyor · ${job.stage}/5` };
  }
  switch (doc.status) {
    case "ready":
      return { symbol: "checkmark.circle", cls: "text-status-done", text: "Hazır" };
    case "failed":
      return { symbol: "exclamationmark.triangle", cls: "text-status-error", text: "Hata" };
    case "pending":
      return { symbol: "clock", cls: "text-label-secondary", text: "Yükleniyor" };
    case "uploaded":
      return { symbol: "clock", cls: "text-status-processing", text: "Sırada" };
    case "processing":
      return { symbol: "arrow.clockwise", cls: "text-status-processing", text: "İşleniyor" };
    default:
      return { symbol: "circle.slash", cls: "text-label-secondary", text: "İptal edildi" };
  }
}

export function StatusLabel({ doc, job, compact }: { doc: Pick<Document, "status">; job?: JobView; compact?: boolean }) {
  const s = statusInfo(doc, job);
  if (compact) return <Icon name={s.symbol} className={s.cls} label={s.text} />;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon name={s.symbol} scale="small" className={s.cls} />
      <span>{s.text}</span>
    </span>
  );
}

export function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}
