"use client";
import { useEffect, useRef, useState } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { Icon } from "@/components/ui/Icon";

interface Props {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  scope: string | null;
  onScope: (collectionId: string | null) => void;
  initial?: string;
}

export function Composer({ streaming, onSend, onStop, scope, onScope, initial = "" }: Props) {
  const [text, setText] = useState(initial);
  const area = useRef<HTMLTextAreaElement>(null);
  const { collections } = useShell();

  useEffect(() => setText(initial), [initial]);

  // Auto-grow up to ~8 lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const send = () => {
    if (!text.trim() || streaming) return;
    onSend(text);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="rounded-sheet bg-bg-secondary border border-separator px-2 py-1.5 space-y-1"
    >
      <label htmlFor="composer" className="sr-only">Soru</label>
      <textarea
        id="composer"
        ref={area}
        rows={1}
        value={text}
        autoFocus
        // Enter sends, Shift+Enter adds a new line.
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dokümanlarınıza bir soru sorun"
        className="block w-full resize-none bg-transparent px-1.5 py-1 t-body text-label outline-none"
      />
      <div className="flex items-center gap-2">
        {/* Scope menu; the broader scope is the default. // HIG: search-fields */}
        <label htmlFor="scope" className="sr-only">Kapsam</label>
        <span className="inline-flex items-center gap-1 rounded-full bg-fill-tertiary pl-2 t-footnote text-label-secondary">
          <Icon name="doc.on.doc" scale="small" />
          <select
            id="scope"
            value={scope ?? ""}
            onChange={(e) => onScope(e.target.value || null)}
            className="hit bg-transparent pr-2 t-footnote text-label outline-none"
          >
            <option value="">Tüm kütüphane</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </span>
        <div className="flex-1" />
        {/* Send and Stop share one position; only a replace transition between them. // HIG: sf-symbols "judiciously" */}
        <span className="relative grid place-items-center w-9 h-9">
          {streaming ? (
            <button key="stop" type="button" onClick={onStop} aria-label="Durdur"
              className="grid place-items-center w-9 h-9 rounded-full text-label t-title2" style={{ animation: "dp-fade-in var(--dur-fast)" }}>
              <Icon name="stop.circle.fill" />
            </button>
          ) : (
            <button key="send" type="submit" disabled={!text.trim()} aria-label="Gönder"
              // Disabled when empty but always visible; the single prominent action.
              className="grid place-items-center w-9 h-9 rounded-full text-accent-fill disabled:text-label-tertiary t-title2"
              style={{ animation: "dp-fade-in var(--dur-fast)" }}>
              <Icon name="arrow.up.circle.fill" />
            </button>
          )}
        </span>
      </div>
    </form>
  );
}
