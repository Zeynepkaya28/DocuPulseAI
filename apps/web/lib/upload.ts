"use client";
import { Upload as TusUpload } from "tus-js-client";
import { ACCEPTED_EXT } from "@docupulse/contracts";
import { SUPABASE_URL, accessToken } from "./supabase";

/** Files above this size use resumable (TUS) upload; Supabase requires 6 MB chunks. */
export const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;
export const MAX_BYTES = 50 * 1024 * 1024;

/** MIME types we can recognise during a drag (names are not available until drop). */
const DRAG_MIME = new Set(["application/pdf", "text/markdown", "text/x-markdown", "text/csv", "text/plain", "application/vnd.ms-excel"]);

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export function isAcceptedFile(f: File): { ok: true } | { ok: false; reason: string } {
  if (!(ACCEPTED_EXT as readonly string[]).includes(extOf(f.name))) return { ok: false, reason: "Bu dosya türü desteklenmiyor" };
  if (f.size === 0) return { ok: false, reason: "Dosya boş" };
  if (f.size > MAX_BYTES) return { ok: false, reason: "Dosya 50 MB sınırını aşıyor" };
  return { ok: true };
}

/** During dragover only item.type is known. Empty type (e.g. .md on Windows) is treated as acceptable. */
export function countAcceptableDragItems(dt: DataTransfer | null): { total: number; acceptable: number } {
  if (!dt) return { total: 0, acceptable: 0 };
  const items = Array.from(dt.items ?? []).filter((i) => i.kind === "file");
  return { total: items.length, acceptable: items.filter((i) => i.type === "" || DRAG_MIME.has(i.type)).length };
}

export interface TransferHandle {
  promise: Promise<void>;
  abort: () => void;
}

/** Upload straight to Supabase Storage — never through Vercel (4.5 MB body limit). */
export function transferFile(
  file: File,
  target: { signed_url: string; storage_path: string; bucket: string },
  mime: string,
  onProgress: (fraction: number) => void,
): TransferHandle {
  if (file.size > RESUMABLE_THRESHOLD) return tusTransfer(file, target, mime, onProgress);

  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", target.signed_url);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Depolama hatası (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Ağ bağlantısı kesildi"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

function tusTransfer(
  file: File,
  target: { storage_path: string; bucket: string },
  mime: string,
  onProgress: (f: number) => void,
): TransferHandle {
  let upload: TusUpload | null = null;
  const promise = (async () => {
    const token = await accessToken();
    await new Promise<void>((resolve, reject) => {
      upload = new TusUpload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}`, "x-upsert": "true" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: RESUMABLE_THRESHOLD, // Supabase requires exactly 6 MB
        metadata: { bucketName: target.bucket, objectName: target.storage_path, contentType: mime, cacheControl: "3600" },
        onError: reject,
        onProgress: (sent, total) => onProgress(sent / total),
        onSuccess: () => resolve(),
      });
      upload.findPreviousUploads().then((prev) => {
        if (prev.length) upload!.resumeFromPreviousUpload(prev[0]);
        upload!.start();
      });
    });
  })();
  return { promise, abort: () => void (upload as TusUpload | null)?.abort(true) };
}
