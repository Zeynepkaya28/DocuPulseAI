"use client";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { ENTITY_KINDS, ENTITY_STYLE } from "@/lib/entityTypes";
import { EntityShape } from "./EntityShape";

/** Legend: every type shown by shape + symbol + color + name. Always reachable from the controls. // HIG: color, accessibility */
export function GraphLegend() {
  return (
    <div className="space-y-2 p-1">
      <Text variant="headline" as="h2">Lejant</Text>
      <ul className="space-y-1.5">
        {ENTITY_KINDS.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <EntityShape type={k} size={22} />
            <Text variant="callout">{ENTITY_STYLE[k].label}</Text>
          </li>
        ))}
      </ul>
      <div className="border-t border-separator pt-2 space-y-1.5">
        <p className="flex items-center gap-2 t-callout">
          <svg width="32" height="8" aria-hidden><line x1="0" y1="4" x2="32" y2="4" stroke="var(--tertiary-label)" strokeWidth="1.5" /></svg>
          İlişki
        </p>
        <p className="flex items-center gap-2 t-callout">
          <svg width="32" height="8" aria-hidden><line x1="0" y1="4" x2="32" y2="4" stroke="rgb(var(--status-warning))" strokeWidth="2" strokeDasharray="6 4" /></svg>
          <Icon name="exclamationmark.triangle" scale="small" className="text-status-warning" />
          Çelişkili ilişki
        </p>
      </div>
    </div>
  );
}
