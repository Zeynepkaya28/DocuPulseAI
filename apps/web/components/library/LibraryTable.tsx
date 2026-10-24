"use client";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Document } from "@docupulse/contracts";
import { useJobs } from "@/components/shell/JobsContext";
import { Icon } from "@/components/ui/Icon";
import { MiddleTruncate } from "@/components/ui/Text";
import { TYPE_LABEL, TYPE_SYMBOL } from "./docTypes";
import { StatusLabel, formatDate, statusInfo } from "./StatusLabel";

type ColKey = "title" | "mime" | "author" | "date" | "entities" | "status";

/** Column titles: noun phrases, Title Case, no punctuation. // HIG: lists-and-tables */
const COLUMNS: { key: ColKey; title: string; width: number; numeric?: boolean }[] = [
  { key: "title", title: "Ad", width: 0 /* fluid until resized */ },
  { key: "mime", title: "Tür", width: 72 },
  { key: "author", title: "Yazar", width: 110 },
  { key: "date", title: "Tarih", width: 104 },
  { key: "entities", title: "Varlık", width: 60, numeric: true },
  { key: "status", title: "Durum", width: 124 },
];

const MIN_W = 60;

interface Props {
  docs: Document[];
  selected: Set<string>;
  focusedId: string | null;
  editing: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  /** Split view with the detail pane open: keep only Ad, Varlık, Durum. */
  narrow?: boolean;
}

export function LibraryTable({ docs, selected, focusedId, editing, onOpen, onToggle, narrow }: Props) {
  const cols = narrow ? COLUMNS.filter((c) => c.key === "title" || c.key === "entities" || c.key === "status") : COLUMNS;
  const show = new Set(cols.map((c) => c.key));
  const { jobs } = useJobs();
  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [widths, setWidths] = useState<Record<ColKey, number>>(
    () => Object.fromEntries(COLUMNS.map((c) => [c.key, c.width])) as Record<ColKey, number>,
  );
  const body = useRef<HTMLTableSectionElement>(null);

  const jobFor = (id: string) => jobs.find((j) => j.documentId === id);

  const sorted = useMemo(() => {
    const val = (d: Document): string | number => {
      switch (sort.key) {
        case "title": return d.title.toLocaleLowerCase("tr");
        case "mime": return TYPE_LABEL[d.mime] ?? d.mime;
        case "author": return (d.author ?? "").toLocaleLowerCase("tr");
        case "date": return d.published_at ?? d.created_at;
        case "entities": return d.entity_count ?? 0;
        case "status": return statusInfo(d).text;
      }
    };
    return [...docs].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [docs, sort]);

  // Click sorts; clicking again reverses. // HIG: lists-and-tables
  const toggleSort = (key: ColKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "date" || key === "entities" ? -1 : 1 }));

  // Resizable columns: pointer drag or ←/→ on the handle.
  const startResize = (key: ColKey, startX: number, current: number) => {
    const startW = widths[key] || current;
    const move = (e: PointerEvent) => setWidths((w) => ({ ...w, [key]: Math.max(MIN_W, startW + e.clientX - startX) }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ↑/↓ moves between rows, Enter opens, Space selects in edit mode. // HIG: accessibility
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    const rows = Array.from(body.current?.querySelectorAll<HTMLTableRowElement>("tr") ?? []);
    const i = rows.indexOf(e.currentTarget);
    if (e.key === "ArrowDown" && i < rows.length - 1) { e.preventDefault(); rows[i + 1].focus(); }
    else if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); rows[i - 1].focus(); }
    else if (e.key === "Enter") onOpen(id);
    else if (e.key === " " && editing) { e.preventDefault(); onToggle(id); }
  };

  return (
    <div className="overflow-auto">
      <table className="w-full table-fixed border-collapse t-body" aria-label="Dokümanlar" aria-multiselectable={editing || undefined}>
        <colgroup>
          {editing && <col style={{ width: 36 }} />}
          {cols.map((c) => <col key={c.key} style={{ width: widths[c.key] || undefined }} />)}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-bg">
          <tr className="border-b border-separator">
            {editing && <th scope="col"><span className="sr-only">Seç</span></th>}
            {cols.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                className={`relative p-0 t-subheadline t-emphasized text-label-secondary ${c.numeric ? "text-right" : "text-left"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(c.key)}
                  className={`hit w-full px-2 inline-flex items-center gap-1 ${c.numeric ? "justify-end" : ""}`}
                >
                  {c.title}
                  {sort.key === c.key && <Icon name={sort.dir === 1 ? "chevron.up" : "chevron.down"} scale="small" />}
                </button>
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`${c.title} sütun genişliği`}
                  aria-valuenow={widths[c.key]}
                  tabIndex={0}
                  onPointerDown={(e) => startResize(c.key, e.clientX, (e.currentTarget.parentElement as HTMLElement).offsetWidth)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") setWidths((w) => ({ ...w, [c.key]: Math.max(MIN_W, (w[c.key] || 320) - 16) }));
                    if (e.key === "ArrowRight") setWidths((w) => ({ ...w, [c.key]: (w[c.key] || 320) + 16 }));
                  }}
                  className="absolute right-0 top-1.5 bottom-1.5 w-2 cursor-col-resize border-r border-separator"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={body}>
          {sorted.map((d, i) => {
            const isSel = selected.has(d.id);
            const isFocus = focusedId === d.id;
            return (
              <tr
                key={d.id}
                tabIndex={0}
                aria-selected={editing ? isSel : isFocus}
                onClick={() => (editing ? onToggle(d.id) : onOpen(d.id))}
                onKeyDown={(e) => onRowKey(e, d.id)}
                className={[
                  "cursor-default outline-offset-[-3px]",
                  // Selection stays highlighted while navigating. Alternating rows on wide tables. // HIG: lists-and-tables
                  isFocus || isSel ? "bg-accent/15" : i % 2 === 1 ? "bg-bg-secondary" : "",
                ].join(" ")}
              >
                {editing && (
                  <td className="px-2">
                    <Icon name={isSel ? "checkmark.circle.fill" : "circle"} className={isSel ? "text-accent" : "text-label-tertiary"} />
                  </td>
                )}
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon name={TYPE_SYMBOL[d.mime] ?? "doc"} className="text-label-secondary" />
                    {/* Middle truncation keeps version/extension visible. // HIG: lists-and-tables */}
                    <MiddleTruncate text={d.title} max={Math.max(12, Math.floor((widths.title || 320) / 8))} className="min-w-0" />
                  </span>
                </td>
                {show.has("mime") && <td className="px-2 text-label-secondary">{TYPE_LABEL[d.mime] ?? "—"}</td>}
                {show.has("author") && <td className="px-2 text-label-secondary truncate">{d.author ?? "—"}</td>}
                {show.has("date") && <td className="px-2 text-label-secondary whitespace-nowrap">{formatDate(d.published_at ?? d.created_at)}</td>}
                <td className="px-2 text-right tabular-nums">{d.entity_count}</td>
                <td className="px-2"><StatusLabel doc={d} job={jobFor(d.id)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
