/**
 * Entity type = color + SHAPE + SYMBOL, never color alone. Each color has one meaning here
 * (and differs from the status colors). // HIG: color, accessibility, sf-symbols
 * `ink` is the symbol color drawn on the solid shape, picked for ≥3:1 contrast on that fill.
 */
export type EntityKind = "person" | "organization" | "concept" | "product" | "event" | "document";
export type Shape = "circle" | "square" | "hexagon" | "rounded" | "diamond" | "pill";

export const ENTITY_STYLE: Record<EntityKind, { label: string; symbol: string; color: string; shape: Shape; ink: "white" | "black" }> = {
  person: { label: "Kişi", symbol: "person.fill", color: "blue", shape: "circle", ink: "white" },
  organization: { label: "Kurum", symbol: "building.2.fill", color: "indigo", shape: "square", ink: "white" },
  concept: { label: "Kavram", symbol: "lightbulb.fill", color: "teal", shape: "hexagon", ink: "black" },
  product: { label: "Ürün", symbol: "shippingbox.fill", color: "orange", shape: "rounded", ink: "black" },
  event: { label: "Tarih/Olay", symbol: "calendar", color: "pink", shape: "diamond", ink: "black" },
  document: { label: "Doküman", symbol: "doc.text.fill", color: "gray", shape: "pill", ink: "black" },
};

export const ENTITY_KINDS = Object.keys(ENTITY_STYLE) as EntityKind[];

export function entityStyle(type: string) {
  return ENTITY_STYLE[(type as EntityKind) in ENTITY_STYLE ? (type as EntityKind) : "concept"];
}
