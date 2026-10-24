"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Api } from "@/lib/api";
import { extOf, isAcceptedFile, transferFile, type TransferHandle } from "@/lib/upload";

export const UNDO_MS = 5000;

const MIME: Record<string, string> = {
  ".pdf": "application/pdf", ".md": "text/markdown", ".markdown": "text/markdown", ".csv": "text/csv", ".txt": "text/plain",
};

export type UploadPhase = "transferring" | "processing" | "failed" | "rejected";

export interface UploadItem {
  key: string;
  name: string;
  size: number;
  ext: string;
  phase: UploadPhase;
  /** 0..1 of the byte transfer (stage 1). */
  transfer: number;
  documentId?: string;
  error?: string;
  /** Processing starts only after this time, so "Geri Al" is possible. // HIG: drag-and-drop */
  undoUntil: number;
  file?: File;
}

let seq = 0;

export function useUploadQueue(collectionId: string | null, onChanged?: () => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const handles = useRef(new Map<string, { transfer?: TransferHandle; undone?: boolean }>());

  const patch = useCallback((key: string, p: Partial<UploadItem>) => {
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));
  }, []);

  const start = useCallback(
    async (item: UploadItem) => {
      const h = { undone: false } as { transfer?: TransferHandle; undone?: boolean };
      handles.current.set(item.key, h);
      try {
        const mime = MIME[item.ext] ?? "text/plain";
        const target = await Api.uploadUrl({ filename: item.name, mime, size_bytes: item.size, collection_id: collectionId });
        if (h.undone) {
          await Api.cancel(target.document_id);
          return;
        }
        patch(item.key, { documentId: target.document_id });
        h.transfer = transferFile(item.file!, target, mime, (f) => patch(item.key, { transfer: f }));
        await h.transfer.promise;
        // Wait out the undo window before processing (which has side effects) begins.
        const wait = item.undoUntil - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (h.undone) return;
        await Api.complete(target.document_id);
        patch(item.key, { phase: "processing", transfer: 1, file: undefined });
        onChanged?.();
      } catch (e) {
        if (h.undone || (e instanceof DOMException && e.name === "AbortError")) return;
        patch(item.key, { phase: "failed", error: e instanceof Error ? e.message : "Yükleme başarısız" });
      }
    },
    [collectionId, onChanged, patch],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const now = Date.now();
      const next: UploadItem[] = files.map((f) => {
        const check = isAcceptedFile(f);
        return {
          key: `u${++seq}`,
          name: f.name,
          size: f.size,
          ext: extOf(f.name),
          phase: check.ok ? "transferring" : "rejected",
          transfer: 0,
          error: check.ok ? undefined : check.reason,
          undoUntil: now + UNDO_MS,
          file: check.ok ? f : undefined,
        };
      });
      // Placeholder rows appear immediately after the drop. // HIG: drag-and-drop
      setItems((xs) => [...next, ...xs]);
      next.filter((i) => i.phase === "transferring").forEach(start);
    },
    [start],
  );

  /** "Geri Al" — only before processing begins. */
  const undo = useCallback(async (key: string) => {
    const h = handles.current.get(key);
    if (h) {
      h.undone = true;
      h.transfer?.abort();
    }
    const item = items.find((i) => i.key === key);
    setItems((xs) => xs.filter((x) => x.key !== key));
    if (item?.documentId) await Api.cancel(item.documentId).catch(() => undefined);
  }, [items]);

  /** Cancel during processing (caller confirms first, progress is lost). */
  const cancel = useCallback(async (key: string) => {
    const item = items.find((i) => i.key === key);
    if (item?.documentId) await Api.cancel(item.documentId);
    setItems((xs) => xs.filter((x) => x.key !== key));
    onChanged?.();
  }, [items, onChanged]);

  const retry = useCallback(async (key: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (item.documentId && item.phase === "processing") {
      await Api.retry(item.documentId);
      return;
    }
    if (item.file) {
      const fresh = { ...item, phase: "transferring" as const, transfer: 0, error: undefined, undoUntil: Date.now() };
      patch(key, fresh);
      start(fresh);
    }
  }, [items, patch, start]);

  const dismiss = useCallback((key: string) => setItems((xs) => xs.filter((x) => x.key !== key)), []);

  // Leave finished rows a moment, then the list relies on the library table.
  useEffect(() => () => handles.current.forEach((h) => h.transfer?.abort()), []);

  return { items, addFiles, undo, cancel, retry, dismiss };
}
