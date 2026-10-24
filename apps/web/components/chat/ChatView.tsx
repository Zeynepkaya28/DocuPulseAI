"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";
import { Toolbar } from "@/components/shell/Toolbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { Text } from "@/components/ui/Text";
import { useStreamingAnswer, type Sources } from "@/hooks/useStreamingAnswer";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { pathLabel } from "./SourceChips";

interface SessionRow { id: string; title: string | null; created_at: string }

function SourcesInspector({ sources, highlight }: { sources?: Sources; highlight: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.querySelector(`[data-chunk="${highlight}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight]);
  if (!sources) {
    return <Text variant="callout" color="secondary" as="p" className="p-4">Bir yanıt seçildiğinde kaynakları burada görünür.</Text>;
  }
  return (
    <div ref={ref} className="p-4 space-y-4">
      <section>
        <Text variant="headline" as="h3" className="mb-2">Pasajlar</Text>
        <ol className="space-y-2">
          {sources.passages.map((p, i) => (
            <li key={p.chunk_id} data-chunk={p.chunk_id}
              className={`rounded-control p-2.5 ${highlight === p.chunk_id ? "bg-accent/15" : "bg-bg-secondary"}`}>
              <Text variant="footnote" color="secondary" as="p" className="flex items-center gap-1 mb-1">
                <Icon name="text.quote" scale="small" className="text-accent" />
                P{i + 1} · {p.document_title}{p.page ? ` · s. ${p.page}` : ""}
              </Text>
              <Text variant="callout" as="p" className="whitespace-pre-wrap">{p.snippet}</Text>
            </li>
          ))}
        </ol>
      </section>
      {sources.paths.length > 0 && (
        <section>
          <Text variant="headline" as="h3" className="mb-2">İlişki Zincirleri</Text>
          <ol className="space-y-1">
            {sources.paths.map((p, i) => (
              <Text key={i} as="li" variant="callout">R{i + 1} · {pathLabel(p)}</Text>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export function ChatView() {
  const params = useSearchParams();
  const router = useRouter();
  const { isRegular } = useShell();
  const { userId } = useSession();
  const chat = useStreamingAnswer();
  const [scope, setScope] = useState<string | null>(params.get("collection"));
  const [inspector, setInspector] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const { loadSession } = chat;

  const initial = useMemo(() => {
    const entity = params.get("entity");
    return params.get("q") ?? (entity ? `${entity} hakkında dokümanlarda ne biliniyor?` : "");
  }, [params]);

  useEffect(() => {
    const id = params.get("session");
    if (id) loadSession(id).catch(() => undefined);
  }, [params, loadSession]);

  useEffect(() => {
    if (userId) api<SessionRow[]>("/chat/sessions").then(setSessions).catch(() => undefined);
  }, [userId, chat.sessionId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [chat.messages]);

  const lastSources = [...chat.messages].reverse().find((m) => m.sources)?.sources;
  const lastIndex = chat.messages.length - 1;
  const showInspector = isRegular && inspector;

  return (
    <>
      <Toolbar
        title="Sohbet"
        tools={
          <>
            <Popover
              label="Geçmiş sohbetler"
              trigger={(p) => (
                <button {...p} type="button" aria-label="Geçmiş sohbetler" className="hit grid place-items-center rounded-full text-label hover:bg-fill-tertiary">
                  <Icon name="clock" />
                </button>
              )}
            >
              {(close) => (
                <ul className="max-h-80 overflow-auto">
                  {sessions.length === 0 && <Text as="li" variant="callout" color="secondary" className="block p-2">Henüz sohbet yok</Text>}
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="hit w-full text-left px-2 rounded-control t-body hover:bg-fill-tertiary truncate"
                        onClick={() => { close(); router.replace(`/chat?session=${s.id}`); }}>
                        {s.title ?? "Adsız sohbet"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Popover>
            <Button variant="plain" icon="square.and.pencil" iconOnly onClick={() => { router.replace("/chat"); loadSession(null); }}>
              Yeni sohbet
            </Button>
            {isRegular && (
              // Inspector toggle at the trailing end. // HIG: layout
              <Button variant="plain" icon="sidebar.trailing" iconOnly aria-pressed={inspector} onClick={() => setInspector((v) => !v)}>
                {inspector ? "Kaynakları gizle" : "Kaynakları göster"}
              </Button>
            )}
          </>
        }
      />

      <div className={`grid ${showInspector ? "grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
        <div className="flex flex-col min-h-[calc(100dvh-var(--toolbar-height))]">
          {/* Readable width, centred. // HIG: layout "readable-width guides" */}
          <div className="flex-1 w-full max-w-readable mx-auto px-4 space-y-4 pb-4" role="log" aria-label="Mesajlar" aria-live="off">
            {chat.messages.length === 0 && (
              <EmptyState symbol="bubble.left.and.text.bubble.right" title="Dokümanlarınıza sorun"
                message="Yanıtlar, kullanılan pasajlar ve bilgi grafiğindeki ilişki zincirleriyle birlikte gelir." />
            )}
            {chat.messages.map((m, i) => (
              <MessageBubble key={m.id} message={m} live={chat.streaming && i === lastIndex} stage={chat.stage}
                onPassage={(id) => { setInspector(true); setHighlight(id); }} />
            ))}
            <div ref={bottom} />
          </div>
          {/* Sentence-by-sentence announcements for screen readers. // HIG: accessibility */}
          <div aria-live="polite" className="sr-only">{chat.announcement}</div>
          <div
            className="scroll-edge-bottom sticky z-10 w-full max-w-readable mx-auto px-4 pb-3 pt-2"
            // Stays clear of the tab bar and the safe area. // HIG: layout
            style={{ bottom: isRegular ? 0 : "calc(var(--tabbar-height) + 20px + env(safe-area-inset-bottom))" }}
          >
            <Composer streaming={chat.streaming} onSend={(t) => chat.ask(t, scope)} onStop={chat.stop}
              scope={scope} onScope={setScope} initial={initial} />
          </div>
        </div>
        {showInspector && (
          <aside aria-label="Kaynaklar" className="border-l border-separator sticky top-0 h-[calc(100dvh-var(--toolbar-height))] overflow-auto">
            <SourcesInspector sources={lastSources} highlight={highlight} />
          </aside>
        )}
      </div>
    </>
  );
}
