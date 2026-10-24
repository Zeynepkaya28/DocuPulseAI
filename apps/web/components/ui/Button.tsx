import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type SymbolWeight } from "./Icon";

export type ButtonVariant = "prominent" | "bordered" | "plain" | "destructive";
export type ButtonSize = "small" | "regular" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * prominent — the ONE primary action in a view, accent fill. // HIG: toolbars "only one primary action"
   * bordered  — neutral fill. plain — borderless (toolbar icons). // HIG: toolbars
   * destructive — red; always paired with a confirmation. // HIG: accessibility
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** SF Symbol name. */
  icon?: string;
  iconWeight?: SymbolWeight;
  /** Icon-only button: children become the accessible name (visually hidden). // HIG: accessibility */
  iconOnly?: boolean;
  children?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  prominent: "bg-accent-fill text-accent-on hover:brightness-110 active:brightness-95",
  bordered: "bg-fill-secondary text-label hover:bg-fill active:bg-fill",
  plain: "bg-transparent text-label hover:bg-fill-tertiary active:bg-fill-secondary",
  destructive: "bg-fill-secondary text-fg-red hover:bg-fill",
};

const SIZE: Record<ButtonSize, string> = {
  small: "t-footnote px-2 gap-1",
  regular: "t-body px-3 gap-1.5",
  large: "t-headline px-4 gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "bordered", size = "regular", icon, iconWeight, iconOnly, className = "", children, type = "button", ...rest },
  ref,
) {
  const weight = iconWeight ?? (variant === "prominent" ? "semibold" : "regular");
  return (
    <button
      ref={ref}
      type={type}
      className={[
        // Hit target: 28x28 recommended on pointer, 44x44 on touch (token switches). // HIG: accessibility
        "inline-flex items-center justify-center rounded-control min-h-hit select-none",
        "transition-[filter,background-color] duration-fast",
        "disabled:opacity-40 disabled:pointer-events-none",
        iconOnly ? "min-w-hit px-1" : SIZE[size],
        VARIANT[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon && <Icon name={icon} weight={weight} scale={size === "small" ? "small" : "medium"} />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  );
});
