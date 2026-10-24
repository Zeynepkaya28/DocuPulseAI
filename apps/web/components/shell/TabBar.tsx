"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { SEARCH, SECTIONS, sectionFor } from "@/lib/nav";
import { useJobs } from "./JobsContext";

/**
 * Compact-width tab bar: floating glass, 4 tabs + a separate Search tab at the trailing end.
 * ≤5 tabs, no "More". Navigation only; actions live in the toolbar. Tabs are never hidden or
 * disabled. // HIG: tab-bars
 */
export function TabBar() {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const onSearch = pathname.startsWith(SEARCH.href);
  const { failedCount } = useJobs();

  return (
    <nav
      aria-label="Sekmeler"
      className="fixed z-30 inset-x-0 flex items-end justify-center gap-2 px-4"
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {/* Monochrome glass; selected tab uses accent only. // HIG: tab-bars, color */}
      <Glass className="flex flex-1 max-w-md rounded-full p-1">
        {SECTIONS.map((s) => {
          const selected = current?.id === s.id;
          // Badge ONLY for a critical state (failed jobs), not for "processing". // HIG: tab-bars
          const badge = s.id === "library" && failedCount > 0 ? failedCount : 0;
          return (
            <Link
              key={s.id}
              href={s.href}
              aria-current={selected ? "page" : undefined}
              aria-label={badge ? `${s.tabLabel}, ${badge} başarısız işlem` : s.tabLabel}
              className={[
                "relative flex-1 flex flex-col items-center justify-center min-h-[48px] rounded-full no-underline",
                selected ? "bg-fill text-accent" : "text-label-secondary",
              ].join(" ")}
            >
              {/* Tab bar icons use the .fill variant. // HIG: tab-bars, sf-symbols */}
              <Icon name={`${s.symbol}.fill`} scale="large" weight={selected ? "semibold" : "regular"} />
              <span className="t-caption2">{s.tabLabel}</span>
              {badge > 0 && (
                <span aria-hidden className="absolute top-0.5 right-[22%] min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white t-caption2 grid place-items-center">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </Glass>
      <Glass className="rounded-full p-1">
        <Link
          href={SEARCH.href}
          aria-current={onSearch ? "page" : undefined}
          aria-label={SEARCH.title}
          className={`grid place-items-center w-[48px] h-[48px] rounded-full ${onSearch ? "bg-fill text-accent" : "text-label-secondary"}`}
        >
          <Icon name={SEARCH.symbol} scale="large" weight={onSearch ? "semibold" : "regular"} />
        </Link>
      </Glass>
    </nav>
  );
}
