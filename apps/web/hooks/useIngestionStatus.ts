"use client";
import { useEffect, useRef, useState } from "react";
import type { Job } from "@docupulse/contracts";
import type { JobView } from "@/components/shell/JobsContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type JobRow = Job & { owner: string; documents?: { title: string } | null };

function toView(row: JobRow, title: string): JobView {
  return {
    id: row.id,
    documentId: row.document_id,
    title,
    stage: row.stage,
    stageName: row.stage_name,
    progress: row.progress,
    total: row.total ?? null,
    status: row.status,
    error: row.error,
    updatedAt: row.updated_at,
  };
}

/**
 * Supabase Realtime `jobs` changes → UI state (Faz A2 ↔ B4 contract).
 * Workers update stage/progress/total; RLS limits the stream to the caller's own jobs.
 */
export function useIngestionStatus(userId: string | null): JobView[] {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const titles = useRef(new Map<string, string>());

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    const sb = supabase();
    let alive = true;

    sb.from("jobs")
      .select("*, documents(title)")
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!alive || !data) return;
        const rows = data as JobRow[];
        rows.forEach((r) => titles.current.set(r.document_id, r.documents?.title ?? "Doküman"));
        setJobs(rows.map((r) => toView(r, titles.current.get(r.document_id)!)));
      });

    const titleFor = async (docId: string) => {
      if (!titles.current.has(docId)) {
        const { data } = await sb.from("documents").select("title").eq("id", docId).maybeSingle();
        titles.current.set(docId, data?.title ?? "Doküman");
      }
      return titles.current.get(docId)!;
    };

    const channel = sb
      .channel(`jobs:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `owner=eq.${userId}` },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setJobs((js) => js.filter((j) => j.id !== id));
            return;
          }
          const row = payload.new as JobRow;
          const view = toView(row, await titleFor(row.document_id));
          setJobs((js) => [view, ...js.filter((j) => j.id !== view.id)]);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      sb.removeChannel(channel);
    };
  }, [userId]);

  return jobs;
}

/** Overall fraction where each of the 5 stages is an equal 20% slice, so progress moves at an even pace. // HIG: progress-indicators */
export function overallProgress(j: Pick<JobView, "stage" | "progress" | "total" | "status">): number | null {
  if (j.status === "done") return 1;
  if (j.total === null || j.total === 0) return null; // indeterminate until the total is known
  return Math.min(1, (j.stage - 1 + Math.min(1, j.progress / j.total)) / 5);
}

export const STALL_MS = 90_000;
