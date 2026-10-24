"use client";
import { Toolbar } from "@/components/shell/Toolbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LibraryPage() {
  return (
    <>
      <Toolbar
        title="Kütüphane"
        primary={<Button variant="prominent" icon="square.and.arrow.up">Yükle</Button>}
      />
      <EmptyState symbol="tray" title="Henüz doküman yok" message="PDF, Markdown, CSV veya TXT dosyalarını buraya sürükleyin." />
    </>
  );
}
