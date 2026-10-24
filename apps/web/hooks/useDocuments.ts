"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Document } from "@docupulse/contracts";
import { useJobs } from "@/components/shell/JobsContext";
import { Api } from "@/lib/api";
import { useSession } from "@/lib/session";

export function useDocuments(collection: string | null) {
  const { userId, loading: sessionLoading } = useSession();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { jobs } = useJobs();

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setDocs(await Api.documents(collection));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dokümanlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [collection, userId]);

  useEffect(() => {
    if (!sessionLoading && !userId) setLoading(false);
    reload();
  }, [reload, sessionLoading, userId]);

  // Refresh when a job reaches a terminal state (status, entity count, summary change).
  const terminal = jobs.filter((j) => j.status === "done" || j.status === "failed").map((j) => j.id + j.status).join();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reload();
  }, [terminal, reload]);

  return { docs, setDocs, loading, error, reload };
}
