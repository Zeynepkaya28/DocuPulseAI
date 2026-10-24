"use client";
import { useEffect, useRef, useState } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { countAcceptableDragItems } from "@/lib/upload";

interface DragState {
  active: boolean;
  total: number;
  acceptable: number;
}

/**
 * The whole window is a drop target. // HIG: drag-and-drop
 * - Highlight (accent frame + "Bırakarak yükle") ONLY when the payload is acceptable and only while
 *   it is over the target; it disappears when the drag leaves.
 * - Unsupported payload: no highlight; circle.slash + reason instead.
 * - Multiple files: a badge with the number of ACCEPTABLE files.
 * The toolbar "Yükle" button is the required alternative path.
 */
export function UploadDropZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const [drag, setDrag] = useState<DragState>({ active: false, total: 0, acceptable: 0 });
  const depth = useRef(0);
  const { isRegular, sidebarOpen } = useShell();

  useEffect(() => {
    if (disabled) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDrag({ active: true, ...countAcceptableDragItems(e.dataTransfer) });
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const { acceptable } = countAcceptableDragItems(e.dataTransfer);
      if (e.dataTransfer) e.dataTransfer.dropEffect = acceptable > 0 ? "copy" : "none";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDrag({ active: false, total: 0, acceptable: 0 });
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDrag({ active: false, total: 0, acceptable: 0 });
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFiles, disabled]);

  if (!drag.active) return null;
  const left = isRegular && sidebarOpen ? "calc(var(--sidebar-width) + 16px)" : "8px";

  if (drag.acceptable === 0) {
    return (
      <div aria-live="assertive" className="fixed inset-0 z-40 pointer-events-none grid place-items-center" style={{ paddingLeft: left }}>
        <Glass className="rounded-full px-4 py-2 flex items-center gap-2">
          <Icon name="circle.slash" className="text-status-error" />
          <Text variant="body">Bu dosya türü desteklenmiyor</Text>
        </Glass>
      </div>
    );
  }

  return (
    <div
      aria-live="assertive"
      className="fixed z-40 pointer-events-none rounded-sheet border-[3px] border-accent grid place-items-center"
      style={{ top: 8, right: 8, bottom: 8, left, background: "rgb(var(--accent) / 0.06)", animation: "dp-fade-in var(--dur-fast) var(--ease)" }}
    >
      <Glass className="rounded-full px-4 py-2 flex items-center gap-2">
        <Icon name="square.and.arrow.up" weight="semibold" className="text-accent" />
        <Text variant="headline">Bırakarak yükle</Text>
        {drag.total > 1 && (
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent-fill text-accent-on t-footnote t-emphasized grid place-items-center"
            aria-label={`${drag.acceptable} dosya`}>
            {drag.acceptable}
          </span>
        )}
      </Glass>
    </div>
  );
}
