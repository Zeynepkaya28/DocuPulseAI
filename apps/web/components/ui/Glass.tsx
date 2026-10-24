import type { ElementType, HTMLAttributes, ReactNode } from "react";

export interface GlassProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /**
   * regular — default; use for text-heavy controls (sidebar, popover, alert).
   * clear   — only over rich visual backgrounds (the graph canvas). // HIG: materials
   */
  variant?: "regular" | "clear";
  /** 35% dimming layer under "clear" when the content beneath is bright. // HIG: materials */
  dim?: boolean;
  children?: ReactNode;
}

/**
 * Glass — CONTROL LAYER ONLY (sidebar, toolbar, tab bar, popover).
 * Never use it for content (cards, list backgrounds, messages). // HIG: materials
 * Glass stays monochrome; color is reserved for the single primary action. // HIG: color "Liquid Glass color"
 * prefers-reduced-transparency swaps it for an opaque background via tokens. // HIG: accessibility
 */
export function Glass({ as: Tag = "div", variant = "regular", dim, className = "", children, ...rest }: GlassProps) {
  return (
    <Tag className={["glass relative isolate", variant === "clear" ? "glass-clear" : "", className].join(" ")} {...rest}>
      {variant === "clear" && dim && (
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]" style={{ background: "var(--glass-dim)" }} />
      )}
      {children}
    </Tag>
  );
}
