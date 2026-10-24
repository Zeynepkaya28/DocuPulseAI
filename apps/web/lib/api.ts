"use client";
import type {
  Collection, Document, GraphResponse, SearchHit, UploadUrlRequest, UploadUrlResponse,
} from "@docupulse/contracts";
import { accessToken } from "./supabase";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : msg;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface DocumentDetail extends Document {
  entities: { id: string; name: string; type: string; degree: number }[];
  chunk_count: number;
}

export interface EntityDetail {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  documents: { id: string; title: string }[];
  relations: { direction: "in" | "out"; type: string; other_id: string; other_name: string; conflict: boolean }[];
}

export const Api = {
  uploadUrl: (body: UploadUrlRequest) => api<UploadUrlResponse>("/documents/upload-url", { method: "POST", body: JSON.stringify(body) }),
  complete: (id: string) => api<Document>(`/documents/${id}/complete`, { method: "POST" }),
  cancel: (id: string) => api<Document>(`/documents/${id}/cancel`, { method: "POST" }),
  retry: (id: string) => api<Document>(`/documents/${id}/retry`, { method: "POST" }),
  documents: (collection?: string | null) =>
    api<Document[]>(`/documents${collection ? `?collection=${encodeURIComponent(collection)}` : ""}`),
  document: (id: string) => api<DocumentDetail>(`/documents/${id}`),
  updateDocument: (id: string, patch: Partial<Pick<Document, "title" | "collection_id" | "author">>) =>
    api<Document>(`/documents/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteDocument: (id: string) => api<void>(`/documents/${id}`, { method: "DELETE" }),
  collections: () => api<Collection[]>("/collections"),
  createCollection: (name: string) => api<Collection>("/collections", { method: "POST", body: JSON.stringify({ name }) }),
  graph: (p: { center?: string; depth?: number; limit?: number; collection?: string | null } = {}) => {
    const q = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => v !== undefined && v !== null && q.set(k, String(v)));
    return api<GraphResponse>(`/graph?${q}`);
  },
  entity: (key: string) => api<EntityDetail>(`/graph/entities/${encodeURIComponent(key)}`),
  search: (q: string, scope: string, filters: Record<string, string> = {}) => {
    const p = new URLSearchParams({ q, scope, ...filters });
    return api<SearchHit[]>(`/search?${p}`);
  },
};
