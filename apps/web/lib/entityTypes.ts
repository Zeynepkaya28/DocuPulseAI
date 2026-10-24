/**
 * Entity type = color + SHAPE + SYMBOL, never color alone. Each color has one meaning here
 * (and differs from the status colors). // HIG: color, accessibility, sf-symbols
 */
export type EntityKind = "person" | "organization" | "concept" | "product" | "event" | "document";

export const ENTITY_STYLE: Record<EntityKind, { label: string; symbol: string; color: string; shape: "circle" | "rounded" | "diamond" | "hexagon" | "square" | "pill" }> = {
  person: { label: "Kişi", symbol: "person.fill", color: "blue", shape: "circle" },
  organization: { label: "Kurum", symbol: "building.2.fill", color: "indigo", shape: "square" },
  concept: { label: "Kavram", symbol: "lightbulb.fill", color: "teal", shape: "hexagon" },
  product: { label: "Ürün", symbol: "shippingbox.fill", color: "orange", shape: "rounded" },
  event: { label: "Tarih/Olay", symbol: "calendar", color: "pink", shape: "diamond" },
  document: { label: "Doküman", symbol: "doc.text.fill", color: "gray", shape: "pill" },
};

export function entityStyle(type: string) {
  return ENTITY_STYLE[(type as EntityKind) in ENTITY_STYLE ? (type as EntityKind) : "concept"];
}
