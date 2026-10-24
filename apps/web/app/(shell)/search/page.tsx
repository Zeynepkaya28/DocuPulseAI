"use client";
import { Toolbar } from "@/components/shell/Toolbar";
import { SearchField } from "@/components/search/SearchField";

/** Compact-width Search tab. On regular widths search lives in the toolbar. // HIG: tab-bars "search tab", search-fields */
export default function SearchPage() {
  return (
    <>
      <Toolbar title="Arama" search={null} />
      <div className="px-4 pb-4">
        <SearchField variant="page" autoFocus />
      </div>
    </>
  );
}
