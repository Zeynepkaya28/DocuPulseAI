"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { Text } from "./Text";

interface AlertDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation for hard-to-undo actions. Never auto-dismisses; the safe choice is the
 * default (focused, and what Escape does). // HIG: accessibility, materials (alerts use regular glass)
 */
export function AlertDialog({ open, title, message, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }: AlertDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="alert-title"
      className="glass rounded-sheet p-0 w-[min(22rem,calc(100vw-2rem))] text-label backdrop:bg-[rgb(0_0_0/0.3)]"
    >
      <div className="p-5 space-y-2 text-center">
        <Text id="alert-title" variant="headline" as="h2">{title}</Text>
        {message && <Text variant="callout" color="secondary" as="div">{message}</Text>}
      </div>
      <div className="flex gap-2 p-3 pt-0">
        <Button ref={cancelRef} className="flex-1" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={destructive ? "destructive" : "prominent"} className="flex-1" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
