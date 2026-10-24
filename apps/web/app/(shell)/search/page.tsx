"use client";
import { Toolbar } from "@/components/shell/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";

/** Compact-width Search tab. On regular widths search lives in the toolbar. // HIG: tab-bars "search tab" */
export default function SearchPage() {
  return (
    <>
      <Toolbar title="Arama" />
      <EmptyState symbol="magnifyingglass" title="Arama" message="Dokümanlarda, varlıklarda ve pasajlarda arayın." />
    </>
  );
}
