"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";
import { Toolbar } from "@/components/shell/Toolbar";
import { DocumentDetail } from "@/components/library/DocumentDetail";
import { LibraryList } from "@/components/library/LibraryList";
import { LibraryTable } from "@/components/library/LibraryTable";
import { UploadDropZone } from "@/components/library/UploadDropZone";
import { UploadQueue } from "@/components/library/UploadQueue";
import { useUploadQueue } from "@/components/library/useUploadQueue";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { useDocuments } from "@/hooks/useDocuments";
import { Api } from "@/lib/api";

const ACCEPT = ".pdf,.md,.markdown,.csv,.txt,application/pdf,text/markdown,text/csv,text/plain";

export default function LibraryPage() {
  const params = useSearchParams();
  const router = useRouter();
  const collection = params.get("collection");
  const focusedId = params.get("doc");
  const { isRegular, collections, setCollections } = useShell();
  const { docs, loading, error, reload } = useDocuments(collection);
  const queue = useUploadQueue(collection, reload);
  const picker = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newCollection, setNewCollection] = useState<string | null>(null);

  const title = collection ? collections.find((c) => c.id === collection)?.name ?? "Koleksiyon" : "Kütüphane";

  const open = useCallback(
    (id: string) => {
      const q = new URLSearchParams(params);
      q.set("doc", id);
      router.replace(`/library?${q}`, { scroll: false });
    },
    [params, router],
  );
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function moveSelected(collectionId: string | null) {
    await Promise.all([...selected].map((id) => Api.updateDocument(id, { collection_id: collectionId })));
    setSelected(new Set());
    setEditing(false);
    reload();
  }

  const showDetail = isRegular && focusedId && !editing;

  return (
    <>
      <Toolbar
        title={title.length > 15 ? `${title.slice(0, 14)}…` : title}
        tools={
          docs.length > 0 && (
            <Button variant="plain" onClick={() => { setEditing((e) => !e); setSelected(new Set()); }}>
              {editing ? "Bitti" : "Düzenle"}
            </Button>
          )
        }
        primary={
          // Alternative to drag and drop. // HIG: drag-and-drop
          <Button variant="prominent" icon="square.and.arrow.up" onClick={() => picker.current?.click()}>Yükle</Button>
        }
      />
      <input ref={picker} type="file" multiple accept={ACCEPT} className="hidden"
        onChange={(e) => { queue.addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <UploadDropZone onFiles={queue.addFiles} />
      <UploadQueue queue={queue} />

      {editing && (
        <div role="toolbar" aria-label="Seçili dokümanlar" className="mx-3 regular:mx-4 mb-3 flex flex-wrap items-center gap-2">
          <Text variant="callout" color="secondary">{selected.size} seçili</Text>
          <div className="flex-1" />
          {newCollection === null ? (
            <>
              <label className="sr-only" htmlFor="bulk-move">Koleksiyona taşı</label>
              <select id="bulk-move" disabled={selected.size === 0} defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = "";
                  if (v === "__new") setNewCollection("");
                  else if (v) moveSelected(v === "__none" ? null : v);
                }}
                className="hit rounded-control bg-fill-secondary px-2 t-body text-label disabled:opacity-40">
                <option value="" disabled>Koleksiyona Taşı</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__none">Koleksiyondan Çıkar</option>
                <option value="__new">Yeni Koleksiyon…</option>
              </select>
            </>
          ) : (
            <form className="flex gap-1" onSubmit={async (e) => {
              e.preventDefault();
              if (!newCollection?.trim()) return;
              const c = await Api.createCollection(newCollection.trim());
              setCollections([...collections, c]);
              setNewCollection(null);
              moveSelected(c.id);
            }}>
              <input autoFocus aria-label="Koleksiyon adı" placeholder="Koleksiyon adı" value={newCollection}
                onChange={(e) => setNewCollection(e.target.value)} className="hit rounded-control bg-fill-tertiary px-2 t-body" />
              <Button type="submit" variant="prominent">Oluştur</Button>
              <Button onClick={() => setNewCollection(null)}>Vazgeç</Button>
            </form>
          )}
          <Button variant="destructive" icon="trash" disabled={selected.size === 0} onClick={() => setConfirmDelete(true)}>Sil</Button>
        </div>
      )}

      {loading ? (
        <div className="px-4 py-8 max-w-sm mx-auto"><ProgressBar label="Dokümanlar yükleniyor" /></div>
      ) : error ? (
        <EmptyState symbol="exclamationmark.triangle" title="Dokümanlar yüklenemedi" message={error}
          action={<Button icon="arrow.clockwise" onClick={reload}>Tekrar Dene</Button>} />
      ) : docs.length === 0 && queue.items.length === 0 ? (
        <EmptyState symbol="tray" title="Henüz doküman yok" message="PDF, Markdown, CSV veya TXT dosyalarını buraya sürükleyin."
          action={<Button variant="prominent" icon="square.and.arrow.up" onClick={() => picker.current?.click()}>Yükle</Button>} />
      ) : isRegular ? (
        // Split view: sidebar | table | detail. Most important content leading and on top. // HIG: layout, sidebars
        <div className={`grid ${showDetail ? "grid-cols-[minmax(0,1fr)_minmax(300px,380px)]" : "grid-cols-1"} gap-0`}>
          <div className="min-w-0 px-2">
            <LibraryTable docs={docs} selected={selected} focusedId={focusedId} editing={editing} onOpen={open} onToggle={toggle} narrow={!!showDetail} />
          </div>
          {showDetail && (
            <aside aria-label="Doküman ayrıntıları" className="border-l border-separator min-h-[calc(100dvh-var(--toolbar-height))] relative">
              <Button variant="plain" icon="xmark" iconOnly className="absolute right-2 top-2"
                onClick={() => router.replace(collection ? `/library?collection=${collection}` : "/library", { scroll: false })}>
                Ayrıntıları kapat
              </Button>
              <DocumentDetail id={focusedId!} onDeleted={() => { router.replace("/library"); reload(); }} />
            </aside>
          )}
        </div>
      ) : (
        <div className="min-h-[calc(100dvh-var(--toolbar-height))] bg-bg-grouped py-2">
          <LibraryList docs={docs} editing={editing} selected={selected} focusedId={focusedId} onToggle={toggle} />
        </div>
      )}

      <AlertDialog
        open={confirmDelete}
        title={`${selected.size} doküman silinsin mi?`}
        message="Dokümanlar, parçaları ve graftaki ilişkileri kalıcı olarak silinir."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await Promise.all([...selected].map((id) => Api.deleteDocument(id)));
          setSelected(new Set());
          setEditing(false);
          reload();
        }}
      />
    </>
  );
}
