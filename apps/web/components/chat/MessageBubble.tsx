"use client";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProgressCircle } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { STAGE_LABEL, takeSentences, type ChatMessage, type StreamStage } from "@/hooks/useStreamingAnswer";
import { useReducedMotion } from "@/lib/useMediaQuery";
import { SourceChips } from "./SourceChips";

/** Inline `code` and [P1]/[R2] citations. */
function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(`[^`]+`|\[[PR]\d+\])/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={`${keyBase}-${i}`} className="font-mono rounded bg-fill-tertiary px-1 text-[0.92em]">{part.slice(1, -1)}</code>;
    }
    if (/^\[[PR]\d+\]$/.test(part)) {
      return <sup key={`${keyBase}-${i}`} className="t-caption2 text-label-secondary">{part}</sup>;
    }
    return part;
  });
}

/** Minimal markdown: fenced code blocks (SF Mono), paragraphs, inline code. // HIG: typography */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/```(?:\w+)?\n?([\s\S]*?)(?:```|$)/g);
  return (
    <>
      {blocks.map((b, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="font-mono t-callout bg-fill-tertiary rounded-control p-2 my-1 overflow-x-auto whitespace-pre">{b}</pre>
        ) : (
          b.split(/\n{2,}/).filter((p) => p.trim()).map((p, j) => (
            <p key={`${i}-${j}`} className="whitespace-pre-wrap [&+p]:mt-2">{inline(p, `${i}-${j}`)}</p>
          ))
        ),
      )}
    </>
  );
}

interface Props {
  message: ChatMessage;
  live?: boolean;
  stage?: StreamStage;
  onPassage?: (chunkId: string) => void;
}

/**
 * User: accent fill + white text. Assistant: secondarySystemBackground. Messages are CONTENT,
 * so no glass. // HIG: materials
 */
export function MessageBubble({ message, live, stage = "idle", onPassage }: Props) {
  const reduced = useReducedMotion();

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-sheet rounded-br-md bg-accent-fill text-accent-on px-3.5 py-2 t-body">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const waiting = live && !message.content && !message.error;
  // Reduced motion: no caret; text arrives a sentence at a time with a fade. // HIG: accessibility
  const shown = live && reduced ? message.content.slice(0, message.content.length - takeSentences(message.content).rest.length) : message.content;

  return (
    <div className="flex justify-start">
      <div className="max-w-full w-full rounded-sheet rounded-bl-md bg-bg-secondary px-3.5 py-2.5 t-body text-label">
        {waiting ? (
          // Indeterminate until the first token, with a concrete label. // HIG: progress-indicators
          <p className="flex items-center gap-2 text-label-secondary">
            <ProgressCircle label={STAGE_LABEL[stage === "idle" ? "searching_graph" : stage]} />
            <span>{STAGE_LABEL[stage === "idle" ? "searching_graph" : stage]}</span>
          </p>
        ) : (
          <div key={reduced ? shown.length : undefined} style={reduced && live ? { animation: "dp-fade-in var(--dur) var(--ease)" } : undefined}>
            <RichText text={shown} />
            {live && !reduced && <span aria-hidden className="inline-block w-[0.5em] h-[1em] align-text-bottom bg-label-secondary animate-pulse ml-0.5" style={{ background: "var(--secondary-label)" }} />}
          </div>
        )}
        {message.stopped && (
          <Text variant="footnote" color="secondary" as="p" className="mt-1 flex items-center gap-1">
            <Icon name="stop.circle" scale="small" /> Yanıt durduruldu
          </Text>
        )}
        {message.error && (
          <Text variant="footnote" as="p" className="mt-1 flex items-center gap-1">
            <Icon name="exclamationmark.triangle" scale="small" className="text-status-error" /> {message.error}
          </Text>
        )}
        {message.sources && <SourceChips sources={message.sources} onPassage={onPassage} />}
      </div>
    </div>
  );
}
