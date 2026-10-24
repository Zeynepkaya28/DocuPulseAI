import type { ElementType, ReactNode, HTMLAttributes } from "react";

export type TextStyle =
  | "largeTitle" | "title1" | "title2" | "title3" | "headline" | "body"
  | "callout" | "subheadline" | "footnote" | "caption1" | "caption2";

export type TextColor = "label" | "secondary" | "tertiary" | "link" | "inherit";

const COLOR: Record<TextColor, string> = {
  label: "text-label",
  secondary: "text-label-secondary",
  tertiary: "text-label-tertiary",
  link: "text-link",
  inherit: "",
};

const DEFAULT_TAG: Partial<Record<TextStyle, ElementType>> = {
  largeTitle: "h1", title1: "h1", title2: "h2", title3: "h3", headline: "h4",
};

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Style names follow the HIG text styles; sizes switch with the size class. // HIG: typography */
  variant?: TextStyle;
  /** Emphasized = semibold/bold weight. // HIG: typography "Emphasized" */
  emphasized?: boolean;
  /** Semantic label color only; never a separator or background color for text. // HIG: color */
  color?: TextColor;
  /** Single line with tail truncation. Use MiddleTruncate for file names. // HIG: lists-and-tables */
  truncate?: boolean;
  children?: ReactNode;
}

export function Text({
  as, variant = "body", emphasized, color = "label", truncate, className = "", children, ...rest
}: TextProps) {
  const Tag = as ?? DEFAULT_TAG[variant] ?? "span";
  const cls = [
    `t-${variant}`,
    emphasized ? "t-emphasized" : "",
    COLOR[color],
    truncate ? "truncate" : "",
    className,
  ].filter(Boolean).join(" ");
  return <Tag className={cls} {...rest}>{children}</Tag>;
}

/**
 * Truncate in the MIDDLE so the end of a file name (version, extension) stays visible.
 * "Yıllık_Rap…_2024_v3.pdf" // HIG: lists-and-tables
 */
export function middleTruncate(value: string, max = 28): string {
  if (value.length <= max) return value;
  const keepEnd = Math.ceil((max - 1) * 0.55);
  const keepStart = max - 1 - keepEnd;
  return `${value.slice(0, keepStart)}…${value.slice(value.length - keepEnd)}`;
}

export function MiddleTruncate({ text, max, className = "" }: { text: string; max?: number; className?: string }) {
  const short = middleTruncate(text, max);
  return (
    <span className={`block whitespace-nowrap overflow-hidden ${className}`} title={short === text ? undefined : text}>
      {short}
    </span>
  );
}
