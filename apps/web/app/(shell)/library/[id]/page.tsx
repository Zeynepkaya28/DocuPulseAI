"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { DocumentDetail } from "@/components/library/DocumentDetail";
import { Toolbar } from "@/components/shell/Toolbar";

/** Compact width: list → detail screen with a chevron back button. // HIG: layout, toolbars */
export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <>
      <Toolbar title="Doküman" backHref="/library" backLabel="Kütüphane" search={null} />
      <DocumentDetail id={id} onDeleted={() => router.replace("/library")} />
    </>
  );
}
