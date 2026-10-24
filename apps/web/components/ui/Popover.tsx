"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Glass } from "./Glass";

interface PopoverProps {
  /** Render prop for the trigger; spread the props onto a button. */
  trigger: (p: { "aria-expanded": boolean; "aria-controls": string; onClick: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  label: string;
  className?: string;
}

/** Popover on regular glass (text-heavy control). // HIG: materials */
export function Popover({ trigger, children, align = "end", label, className = "" }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        (root.current?.querySelector("button") as HTMLButtonElement | null)?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={root} className="relative">
      {trigger({ "aria-expanded": open, "aria-controls": id, onClick: () => setOpen((o) => !o) })}
      {open && (
        <Glass
          id={id}
          role="dialog"
          aria-label={label}
          className={`absolute top-full mt-2 z-50 rounded-card p-2 w-80 max-w-[calc(100vw-2rem)] ${align === "end" ? "right-0" : "left-0"} ${className}`}
          style={{ animation: "dp-fade-in var(--dur-fast) var(--ease)" }}
        >
          <div ref={panel} tabIndex={-1} className="outline-none">
            {typeof children === "function" ? children(close) : children}
          </div>
        </Glass>
      )}
    </div>
  );
}
