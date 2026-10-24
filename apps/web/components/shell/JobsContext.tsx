"use client";
import { createContext, useContext, type ReactNode } from "react";

/** UI view of a background ingestion job. Filled by useIngestionStatus (Faz A2). */
export interface JobView {
  id: string;
  documentId: string;
  title: string;
  stage: number; // 1..5
  stageName: string;
  progress: number;
  total: number | null;
  status: "queued" | "running" | "done" | "failed" | "canceled";
  error?: string | null;
}

interface JobsState {
  jobs: JobView[];
  activeCount: number;
  failedCount: number;
}

const JobsContext = createContext<JobsState>({ jobs: [], activeCount: 0, failedCount: 0 });

export function JobsProvider({ jobs, children }: { jobs: JobView[]; children: ReactNode }) {
  const activeCount = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  return <JobsContext.Provider value={{ jobs, activeCount, failedCount }}>{children}</JobsContext.Provider>;
}

export const useJobs = () => useContext(JobsContext);
