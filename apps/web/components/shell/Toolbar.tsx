"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { JobsIndicator } from "./JobsIndicator";
import { useShell } from "./ShellContext";

export interface ToolbarProps {
  /** ≤15 characters and never the app name. // HIG: toolbars */
  title: string;
  /** Back target; rendered as a chevron symbol, not text. // HIG: toolbars */
  backHref?: string;
  backLabel?: string;
  /** Search field slot (regular width only). // HIG: search-fields */
  search?: ReactNode;
  /** Extra borderless icon buttons (e.g. inspector toggle). */
  tools?: ReactNode;
  /** The single .prominent primary action, at the trailing end. // HIG: toolbars */
  primary?: ReactNode;
}

/**
 * Toolbar: no background of its own; separated from content by the scroll edge effect.
 * At most three groups: [leading nav + title] [tools] [primary]. No hand-made overflow menu. // HIG: toolbars
 */
export function Toolbar({ title, backHref, backLabel = "Geri", search, tools, primary }: ToolbarProps) {
  const { isRegular, sidebarOpen, toggleSidebar } = useShell();
  if (process.env.NODE_ENV !== "production" && title.length > 15) {
    console.warn(`[HIG: toolbars] Toolbar title "${title}" exceeds 15 characters`);
  }

  return (
    <header
      className="scroll-edge-top sticky top-0 z-20 h-toolbar flex items-center gap-3 px-3 regular:px-4"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Group 1 — leading: sidebar toggle, back, title. */}
      <div className="flex items-center gap-1 min-w-0">
        {isRegular && (
          <Glass className="rounded-full">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-pressed={sidebarOpen}
              aria-label={sidebarOpen ? "Kenar çubuğunu gizle" : "Kenar çubuğunu göster"}
              className="hit grid place-items-center rounded-full text-label hover:bg-fill-tertiary"
            >
              <Icon name="sidebar.leading" />
            </button>
          </Glass>
        )}
        {backHref && (
          <Glass className="rounded-full">
            <Link href={backHref} aria-label={backLabel} className="hit grid place-items-center rounded-full text-label">
              <Icon name="chevron.backward" weight="semibold" />
            </Link>
          </Glass>
        )}
        <Text variant={isRegular ? "headline" : "title3"} emphasized as="h1" truncate className="px-1">
          {title}
        </Text>
      </div>

      <div className="flex-1" />

      {/* Group 2 — tools: search (regular), global jobs indicator (fixed slot), extras. */}
      <Glass className="flex items-center gap-0.5 rounded-full px-1 empty:hidden">
        {isRegular && search}
        <JobsIndicator />
        {tools}
      </Glass>

      {/* Group 3 — one prominent primary action. */}
      {primary}
    </header>
  );
}
