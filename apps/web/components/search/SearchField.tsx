"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit, SearchScope } from "@docupulse/contracts";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { ProgressCircle } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { Api } from "@/lib/api";
import { useIsRegular } from "@/lib/useMediaQuery";

/** Default scope is the broadest one. // HIG: search-fields */
const SCOPES: { id: SearchScope; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "documents", label: "Dokümanlar" },
  { id: "entities", label: "Varlıklar" },
  { id: "passages", label: "Pasajlar" },
];

interface Token { key: "type" | "author"; label: string; value: string }

const TYPE_TOKENS: Token[] = [
  { key: "type", label: "Tür: PDF", value: "pdf" },
  { key: "type", label: "Tür: Markdown", value: "md" },
  { key: "type", label: "Tür: CSV", value: "csv" },
  { key: "type", label: "Tür: TXT", value: "txt" },
];

const KIND_SYMBOL: Record<SearchHit["kind"], string> = { document: "doc.text", entity: "point.3.connected.trianglepath.dotted", passage: "text.quote" };
const KIND_LABEL: Record<SearchHit["kind"], string> = { document: "Doküman", entity: "Varlık", passage: "Pasaj" };
const RECENT_KEY = "dp-recent-searches";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  try {
    const next = [q, ...loadRecent().filter((x) => x !== q)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

export function SearchField({ variant = "toolbar", autoFocus }: { variant?: "toolbar" | "page"; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(variant === "page");
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isRegular = useIsRegular();

  useEffect(() => setRecent(loadRecent()), [open]);

  // Live results while typing, debounced ~200 ms. // HIG: search-fields
  useEffect(() => {
    const q = text.trim();
    if (!q && tokens.length === 0) {
      setHits([]);
      return;
    }
    setLoading(true);
    const filters: Record<string, string> = {};
    tokens.forEach((t) => (filters[t.key] = t.value));
    const t = setTimeout(() => {
      Api.search(q, scope, filters)
        .then((r) => setHits(r))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [text, scope, tokens]);

  // Close the toolbar dropdown when clicking outside.
  useEffect(() => {
    if (variant === "page" || !open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, variant]);

  // Suggestions while typing: filter tokens. Before typing: recent searches. // HIG: search-fields
  const tokenSuggestions = useMemo(() => {
    const q = text.trim().toLocaleLowerCase("tr");
    if (!q) return [];
    const typeMatches = TYPE_TOKENS.filter((t) => t.label.toLocaleLowerCase("tr").includes(q.replace(/^t[uü]r:?\s*/, "")) && !tokens.some((x) => x.key === "type"));
    const author = /^yazar:\s*(.+)$/i.exec(text.trim());
    return [
      ...(q.startsWith("tür") || q.startsWith("tur") ? typeMatches : typeMatches.slice(0, 0)),
      ...(author ? [{ key: "author" as const, label: `Yazar: ${author[1]}`, value: author[1] }] : []),
    ];
  }, [text, tokens]);

  const showRecent = !text.trim() && tokens.length === 0 && recent.length > 0;
  const options = showRecent ? recent.length : tokenSuggestions.length + hits.length;

  function go(hit: SearchHit) {
    saveRecent(text.trim() || hit.title);
    if (variant === "toolbar") setOpen(false);
    if (hit.kind === "entity") router.push(`/graph?focus=${encodeURIComponent(hit.id)}`);
    else if (isRegular) router.push(`/library?doc=${hit.document_id ?? hit.id}`);
    else router.push(`/library/${hit.document_id ?? hit.id}`);
  }

  function choose(i: number) {
    if (showRecent) {
      setText(recent[i]);
      return;
    }
    if (i < tokenSuggestions.length) {
      setTokens((ts) => [...ts.filter((t) => t.key !== tokenSuggestions[i].key), tokenSuggestions[i]]);
      setText("");
      return;
    }
    go(hits[i - tokenSuggestions.length]);
  }

  const panel = (
    <div className={variant === "toolbar" ? "p-2 space-y-2" : "space-y-3"}>
      {/* Scope bar */}
      <div role="radiogroup" aria-label="Arama kapsamı" className="flex gap-1 rounded-control bg-fill-tertiary p-0.5">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={scope === s.id}
            onClick={() => setScope(s.id)}
            className={`hit flex-1 rounded-[6px] t-footnote ${scope === s.id ? "bg-bg text-label t-emphasized shadow-sm" : "text-label-secondary"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ul id={listId} role="listbox" aria-label="Arama sonuçları" className="max-h-[60vh] overflow-auto">
        {showRecent && (
          <>
            <Text as="li" role="presentation" variant="footnote" color="secondary" emphasized className="block px-2 py-1">Son Aramalar</Text>
            {recent.map((r, i) => (
              <li key={r} id={`${listId}-${i}`} role="option" aria-selected={active === i}
                onMouseDown={(e) => { e.preventDefault(); choose(i); }}
                className={`flex items-center gap-2 px-2 min-h-hit rounded-control t-body cursor-default ${active === i ? "bg-fill" : "hover:bg-fill-tertiary"}`}>
                <Icon name="clock" className="text-label-secondary" />{r}
              </li>
            ))}
          </>
        )}
        {!showRecent && tokenSuggestions.map((t, i) => (
          <li key={t.label} id={`${listId}-${i}`} role="option" aria-selected={active === i}
            onMouseDown={(e) => { e.preventDefault(); choose(i); }}
            className={`flex items-center gap-2 px-2 min-h-hit rounded-control t-body cursor-default ${active === i ? "bg-fill" : "hover:bg-fill-tertiary"}`}>
            <Icon name="line.3.horizontal.decrease" className="text-accent" />{t.label}
          </li>
        ))}
        {!showRecent && hits.map((h, j) => {
          const i = j + tokenSuggestions.length;
          return (
            <li key={`${h.kind}-${h.id}`} id={`${listId}-${i}`} role="option" aria-selected={active === i}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }}
              className={`flex items-start gap-2 px-2 py-1.5 rounded-control cursor-default ${active === i ? "bg-fill" : "hover:bg-fill-tertiary"}`}>
              <Icon name={KIND_SYMBOL[h.kind]} className="text-accent mt-0.5" label={KIND_LABEL[h.kind]} />
              <span className="min-w-0 flex-1">
                <Text variant="body" as="span" className="block line-clamp-2">{h.title}</Text>
                {h.subtitle && <Text variant="footnote" color="secondary" truncate as="span" className="block">{h.subtitle}</Text>}
              </span>
            </li>
          );
        })}
        {!showRecent && !loading && options === 0 && (text.trim() || tokens.length > 0) && (
          <Text as="li" role="presentation" variant="callout" color="secondary" className="block px-2 py-3">Sonuç bulunamadı</Text>
        )}
      </ul>
    </div>
  );

  return (
    <div ref={root} className={variant === "toolbar" ? "relative" : "space-y-3"}>
      <div className={`flex items-center gap-1.5 rounded-full px-2.5 ${variant === "toolbar" ? "w-56 lg:w-72 h-hit" : "h-11 bg-fill-tertiary"}`}>
        {loading ? <ProgressCircle label="Aranıyor" size={14} /> : <Icon name="magnifyingglass" className="text-label-secondary" />}
        {tokens.map((t) => (
          <span key={t.key} className="inline-flex items-center gap-0.5 rounded-full bg-accent/20 pl-2 pr-0.5 t-footnote whitespace-nowrap">
            {t.label}
            <button type="button" aria-label={`${t.label} filtresini kaldır`} className="grid place-items-center w-5 h-5 rounded-full hover:bg-fill"
              onClick={() => setTokens((ts) => ts.filter((x) => x !== t))}>
              <Icon name="xmark" scale="small" />
            </button>
          </span>
        ))}
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Ara"
          // Placeholder states what is searched. // HIG: search-fields
          placeholder="Dokümanlarda, varlıklarda ara"
          autoFocus={autoFocus}
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options - 1, a + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(active); }
            else if (e.key === "Enter" && hits[0]) { e.preventDefault(); go(hits[0]); }
            else if (e.key === "Backspace" && !text && tokens.length) setTokens((ts) => ts.slice(0, -1));
            else if (e.key === "Escape") { if (text) setText(""); else setOpen(false); }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none t-body text-label [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button type="button" aria-label="Aramayı temizle" onClick={() => { setText(""); input.current?.focus(); }}
            className="grid place-items-center w-6 h-6 rounded-full text-label-secondary">
            <Icon name="xmark.circle" />
          </button>
        )}
      </div>
      {variant === "page"
        ? panel
        : open && (
            <Glass className="absolute right-0 top-full mt-2 z-50 rounded-card w-[min(26rem,calc(100vw-2rem))]">{panel}</Glass>
          )}
    </div>
  );
}
