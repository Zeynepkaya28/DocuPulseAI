"use client";
import { useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Toolbar } from "@/components/shell/Toolbar";
import { UploadDropZone } from "@/components/library/UploadDropZone";
import { UploadQueue } from "@/components/library/UploadQueue";
import { useUploadQueue } from "@/components/library/useUploadQueue";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const ACCEPT = ".pdf,.md,.markdown,.csv,.txt,application/pdf,text/markdown,text/csv,text/plain";

export default function LibraryPage() {
  const params = useSearchParams();
  const collection = params.get("collection");
  const queue = useUploadQueue(collection);
  const picker = useRef<HTMLInputElement>(null);

  return (
    <>
      <Toolbar
        title="Kütüphane"
        primary={
          // Alternative to drag and drop. // HIG: drag-and-drop
          <Button variant="prominent" icon="square.and.arrow.up" onClick={() => picker.current?.click()}>Yükle</Button>
        }
      />
      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          queue.addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <UploadDropZone onFiles={queue.addFiles} />
      <UploadQueue queue={queue} />
      {queue.items.length === 0 && (
        <EmptyState
          symbol="tray"
          title="Henüz doküman yok"
          message="PDF, Markdown, CSV veya TXT dosyalarını buraya sürükleyin."
          action={<Button variant="prominent" icon="square.and.arrow.up" onClick={() => picker.current?.click()}>Yükle</Button>}
        />
      )}
    </>
  );
}
