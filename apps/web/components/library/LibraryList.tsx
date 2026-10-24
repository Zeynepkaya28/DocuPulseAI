"use client";
import Link from "next/link";
import type { Document } from "@docupulse/contracts";
import { useJobs } from "@/components/shell/JobsContext";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { TYPE_SYMBOL } from "./docTypes";
import { StatusLabel, formatDate } from "./StatusLabel";

interface Props {
  docs: Document[];
  editing: boolean;
  selected: Set<string>;
  focusedId: string | null;
  onToggle: (id: string) => void;
}

/**
 * Compact width: inset-grouped list on systemGroupedBackground. // HIG: lists-and-tables, color
 * Row: type symbol · title (body) · author · date (footnote, secondary) · status · disclosure chevron.
 * No alphabet index because rows have disclosure indicators. // HIG: lists-and-tables
 */
export function LibraryList({ docs, editing, selected, focusedId, onToggle }: Props) {
  const { jobs } = useJobs();
  return (
    <ul aria-label="Dokümanlar" className="mx-4 rounded-card bg-bg-grouped-secondary overflow-hidden divide-y divide-separator">
      {docs.map((d) => {
        const isSel = selected.has(d.id);
        const content = (
          <>
            {editing && (
              <Icon name={isSel ? "checkmark.circle.fill" : "circle"} scale="large" className={isSel ? "text-accent" : "text-label-tertiary"} />
            )}
            <Icon name={TYPE_SYMBOL[d.mime] ?? "doc"} scale="large" className="text-accent" />
            <span className="flex-1 min-w-0">
              <Text variant="body" truncate as="span" className="block">{d.title}</Text>
              <Text variant="footnote" color="secondary" truncate as="span" className="block">
                {[d.author, formatDate(d.published_at ?? d.created_at)].filter(Boolean).join(" · ")}
              </Text>
            </span>
            <StatusLabel doc={d} job={jobs.find((j) => j.documentId === d.id)} compact />
            {!editing && <Icon name="chevron.forward" weight="semibold" className="text-label-tertiary" />}
          </>
        );
        const cls = `flex items-center gap-3 px-4 min-h-[56px] py-2 text-label no-underline ${
          focusedId === d.id || isSel ? "bg-fill" : "active:bg-fill-tertiary"
        }`;
        return (
          <li key={d.id}>
            {editing ? (
              <button type="button" role="checkbox" aria-checked={isSel} onClick={() => onToggle(d.id)} className={`${cls} w-full text-left`}>
                {content}
              </button>
            ) : (
              <Link href={`/library/${d.id}`} className={cls}>{content}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
