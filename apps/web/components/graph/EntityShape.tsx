import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { entityStyle, type Shape } from "@/lib/entityTypes";

const CLIP: Partial<Record<Shape, string>> = {
  hexagon: "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)",
  diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
};
const RADIUS: Record<Shape, string> = {
  circle: "999px", square: "4px", hexagon: "0", rounded: "10px", diamond: "0", pill: "999px",
};

/** Solid shape + symbol for an entity type. Shared by graph nodes and the legend. */
export function EntityShape({ type, size = 36, style }: { type: string; size?: number; style?: CSSProperties }) {
  const st = entityStyle(type);
  return (
    <span
      aria-hidden
      className="inline-grid place-items-center flex-none"
      style={{
        width: st.shape === "pill" ? size * 1.4 : size,
        height: size,
        background: `rgb(var(--c-${st.color}))`,
        color: st.ink === "white" ? "rgb(var(--on-accent))" : "rgb(var(--on-light))",
        borderRadius: RADIUS[st.shape],
        clipPath: CLIP[st.shape],
        fontSize: size * 0.42,
        ...style,
      }}
    >
      <Icon name={st.symbol} scale="medium" weight="semibold" />
    </span>
  );
}
