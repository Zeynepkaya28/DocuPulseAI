"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { SECTIONS, sectionFor } from "@/lib/nav";
import { useShell } from "./ShellContext";

function useModifierLabel() {
  const [mod, setMod] = useState("Ctrl+");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod("⌘");
  }, []);
  return mod;
}

/**
 * Leading-edge sidebar on regular widths. Floats on regular glass above content; content
 * extends beneath it. // HIG: sidebars, layout, materials
 * Max two levels: "Bölümler" + "Koleksiyonlar". Deeper content uses sidebar → list → detail. // HIG: sidebars
 */
export function Sidebar() {
  const { sidebarOpen, collections } = useShell();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = sectionFor(pathname);
  const activeCollection = params.get("collection");
  const mod = useModifierLabel();

  return (
    <Glass
      as="nav"
      aria-label="Kenar çubuğu"
      aria-hidden={!sidebarOpen}
      inert={!sidebarOpen}
      className={[
        "fixed z-30 top-2 bottom-2 left-2 w-sidebar rounded-sheet flex flex-col pt-toolbar overflow-y-auto",
        "transition-[transform,opacity] duration motion-transform",
        sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-[110%] opacity-0",
      ].join(" ")}
    >
      {/* Short group headers. // HIG: sidebars */}
      <Text variant="subheadline" emphasized color="secondary" as="h2" className="px-4 pb-1">Bölümler</Text>
      <ul className="px-2 space-y-0.5">
        {SECTIONS.map((s) => {
          const selected = current?.id === s.id && !activeCollection;
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                aria-current={selected ? "page" : undefined}
                className={[
                  "hit flex items-center gap-2 px-2 rounded-control t-body no-underline",
                  // Persistent selection highlight. // HIG: sidebars, lists-and-tables
                  selected ? "bg-fill text-label" : "text-label hover:bg-fill-tertiary",
                ].join(" ")}
              >
                {/* Sidebar icons use the accent color. // HIG: sidebars */}
                <Icon name={selected ? `${s.symbol}.fill` : s.symbol} className="text-accent" />
                <span className="flex-1">{s.title}</span>
                <kbd className="t-caption1 text-label-secondary" aria-label={`Kısayol ${mod}${s.shortcut}`}>{mod}{s.shortcut}</kbd>
              </Link>
            </li>
          );
        })}
      </ul>

      <Text variant="subheadline" emphasized color="secondary" as="h2" className="px-4 pt-5 pb-1">Koleksiyonlar</Text>
      {collections.length === 0 ? (
        <Text variant="footnote" color="secondary" as="p" className="px-4">Henüz koleksiyon yok</Text>
      ) : (
        <ul className="px-2 space-y-0.5">
          {collections.map((c) => {
            const selected = activeCollection === c.id;
            return (
              <li key={c.id}>
                <Link
                  href={`/library?collection=${c.id}`}
                  aria-current={selected ? "page" : undefined}
                  className={`hit flex items-center gap-2 px-2 rounded-control t-body no-underline text-label ${selected ? "bg-fill" : "hover:bg-fill-tertiary"}`}
                >
                  <Icon name={selected ? "folder.fill" : "folder"} className="text-accent" />
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {/* Nothing critical at the bottom of the sidebar or window. // HIG: sidebars, layout (macOS) */}
    </Glass>
  );
}
