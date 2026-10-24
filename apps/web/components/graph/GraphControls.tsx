"use client";
import { useReactFlow } from "@xyflow/react";
import { useShell } from "@/components/shell/ShellContext";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { Text } from "@/components/ui/Text";
import { ENTITY_KINDS, ENTITY_STYLE, type EntityKind } from "@/lib/entityTypes";
import { EntityShape } from "./EntityShape";
import { GraphLegend } from "./GraphLegend";
import type { LayoutKind } from "./layout";

interface Props {
  layout: LayoutKind;
  onLayout: (l: LayoutKind) => void;
  hidden: Set<EntityKind>;
  onToggleType: (k: EntityKind) => void;
  minimap: boolean;
  onMinimap: () => void;
  listView: boolean;
  onListView: () => void;
}

const btn = "hit grid place-items-center rounded-full text-label hover:bg-fill-tertiary";

/**
 * Controls over the canvas = control layer → glass. The graph is visually rich, so the "clear" variant
 * with 35% dimming is used. Clusters stay monochrome so they never echo node colors. // HIG: materials, color
 */
export function GraphControls({ layout, onLayout, hidden, onToggleType, minimap, onMinimap, listView, onListView }: Props) {
  const flow = useReactFlow();
  const { isRegular, sidebarOpen } = useShell();
  return (
    <div className="absolute z-10 flex flex-col gap-2 transition-[left] duration motion-transform"
      // Clear of the floating sidebar. // HIG: sidebars
      style={{ bottom: "var(--controls-bottom, 12px)", left: isRegular && sidebarOpen ? "calc(var(--sidebar-width) + 20px)" : "12px" }}>
      {!listView && (
        <Glass variant="clear" dim className="flex flex-col rounded-full p-0.5" role="group" aria-label="Yakınlaştırma">
          <button type="button" className={btn} onClick={() => flow.zoomIn()} aria-label="Yakınlaştır"><Icon name="plus" /></button>
          <button type="button" className={btn} onClick={() => flow.zoomOut()} aria-label="Uzaklaştır"><Icon name="minus" /></button>
          <button type="button" className={btn} onClick={() => flow.fitView({ padding: 0.25, duration: 300 })} aria-label="Tümünü sığdır"><Icon name="scope" /></button>
        </Glass>
      )}
      <Glass variant="clear" dim className="flex flex-col rounded-full p-0.5" role="group" aria-label="Görünüm">
        <Popover
          align="start"
          label="Filtre ve düzen"
          side="top"
          trigger={(p) => <button {...p} type="button" className={btn} aria-label="Filtre ve düzen"><Icon name="line.3.horizontal.decrease" /></button>}
        >
          <div className="p-1 space-y-3">
            <fieldset>
              <Text as="legend" variant="headline" className="mb-1">Düzen</Text>
              {(["force", "radial"] as const).map((l) => (
                <label key={l} className="hit flex items-center gap-2 px-1 rounded-control t-body hover:bg-fill-tertiary">
                  <input type="radio" name="layout" checked={layout === l} onChange={() => onLayout(l)} className="accent-[rgb(var(--accent))]" />
                  {l === "force" ? "Kuvvet yönelimli" : "Türe göre halkalar"}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <Text as="legend" variant="headline" className="mb-1">Varlık Türleri</Text>
              {ENTITY_KINDS.filter((k) => k !== "document").map((k) => (
                <label key={k} className="hit flex items-center gap-2 px-1 rounded-control t-body hover:bg-fill-tertiary">
                  <input type="checkbox" checked={!hidden.has(k)} onChange={() => onToggleType(k)} className="accent-[rgb(var(--accent))]" />
                  <EntityShape type={k} size={18} />
                  {ENTITY_STYLE[k].label}
                </label>
              ))}
            </fieldset>
          </div>
        </Popover>
        <Popover
          align="start"
          label="Lejant"
          side="top"
          className="w-64"
          trigger={(p) => <button {...p} type="button" className={btn} aria-label="Lejant"><Icon name="info.circle" /></button>}
        >
          <GraphLegend />
        </Popover>
        {!listView && (
          <button type="button" className={btn} aria-pressed={minimap} onClick={onMinimap} aria-label={minimap ? "Mini haritayı gizle" : "Mini haritayı göster"}>
            <Icon name="map" />
          </button>
        )}
        {/* Alternative for screen readers: table view. // HIG: accessibility "multiple ways to interact" */}
        <button type="button" className={btn} aria-pressed={listView} onClick={onListView} aria-label={listView ? "Graf görünümü" : "Liste görünümü"}>
          <Icon name={listView ? "point.3.connected.trianglepath.dotted" : "list.bullet"} />
        </button>
      </Glass>
    </div>
  );
}
