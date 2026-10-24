"use client";
import { useCallback, useRef, useState } from "react";
import type { ChatEvent, ChatSourcesEvent } from "@docupulse/contracts";
import { API_URL, api } from "@/lib/api";
import { accessToken } from "@/lib/supabase";

export type Sources = Omit<ChatSourcesEvent, "type">;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Sources;
  error?: string;
  stopped?: boolean;
}

export type StreamStage = "idle" | "searching_graph" | "searching_passages" | "writing";

/** Concrete stage labels — never a vague "Düşünüyor…". // HIG: progress-indicators */
export const STAGE_LABEL: Record<Exclude<StreamStage, "idle">, string> = {
  searching_graph: "Grafta ilişkiler aranıyor",
  searching_passages: "Pasajlar aranıyor",
  writing: "Yanıt yazılıyor",
};

/** Splits off complete sentences so screen readers hear the answer sentence by sentence, not token by token. */
export function takeSentences(buffer: string): { done: string[]; rest: string } {
  const re = /[^.!?…\n]+[.!?…]+["')\]]*\s+|[^\n]+\n/g;
  const done: string[] = [];
  let last = 0;
  for (let m = re.exec(buffer); m; m = re.exec(buffer)) {
    done.push(m[0].trim());
    last = re.lastIndex;
  }
  return { done: done.filter(Boolean), rest: buffer.slice(last) };
}

let seq = 0;
const localId = () => `local-${++seq}`;

export function useStreamingAnswer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage, setStage] = useState<StreamStage>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const abort = useRef<AbortController | null>(null);

  const patchLast = (p: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) =>
    setMessages((ms) => {
      const last = ms[ms.length - 1];
      if (!last || last.role !== "assistant") return ms;
      return [...ms.slice(0, -1), { ...last, ...(typeof p === "function" ? p(last) : p) }];
    });

  const loadSession = useCallback(async (id: string | null) => {
    abort.current?.abort();
    setSessionId(id);
    setStage("idle");
    if (!id) {
      setMessages([]);
      return;
    }
    const rows = await api<{ id: string; role: "user" | "assistant"; content: string; sources: Sources | null }[]>(
      `/chat/sessions/${id}/messages`,
    );
    setMessages(rows.map((r) => ({ id: r.id, role: r.role, content: r.content, sources: r.sources && "passages" in r.sources ? r.sources : undefined })));
  }, []);

  const ask = useCallback(
    async (question: string, collectionId: string | null) => {
      const q = question.trim();
      if (!q || abort.current) return;
      const ctrl = new AbortController();
      abort.current = ctrl;
      setMessages((ms) => [...ms, { id: localId(), role: "user", content: q }, { id: localId(), role: "assistant", content: "" }]);
      setStage("searching_graph");
      let pending = "";

      try {
        const token = await accessToken();
        const res = await fetch(`${API_URL}/chat`, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ question: q, session_id: sessionId, collection_id: collectionId }),
        });
        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(typeof detail.detail === "string" ? detail.detail : "Yanıt alınamadı");
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const ev = JSON.parse(line.slice(6)) as ChatEvent;
            switch (ev.type) {
              case "status":
                setStage(ev.stage);
                if (ev.session_id) setSessionId(ev.session_id);
                break;
              case "token": {
                setStage("writing");
                patchLast((m) => ({ content: m.content + ev.text }));
                pending += ev.text;
                const { done: sentences, rest } = takeSentences(pending);
                pending = rest;
                if (sentences.length) setAnnouncement(sentences.join(" "));
                break;
              }
              case "sources":
                patchLast({ sources: { passages: ev.passages, paths: ev.paths, conflicts: ev.conflicts } });
                break;
              case "done":
                patchLast({ id: ev.message_id });
                break;
              case "error":
                patchLast({ error: ev.message });
                break;
            }
          }
        }
        if (pending.trim()) setAnnouncement(pending.trim());
      } catch (e) {
        if (ctrl.signal.aborted) patchLast({ stopped: true });
        else patchLast({ error: e instanceof Error ? e.message : "Yanıt alınamadı" });
      } finally {
        abort.current = null;
        setStage("idle");
      }
    },
    [sessionId],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  return { messages, stage, streaming: stage !== "idle", ask, stop, sessionId, loadSession, announcement };
}
