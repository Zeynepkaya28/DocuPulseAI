/** Information architecture: 4 sections + search. // HIG: sidebars, tab-bars */
export interface Section {
  id: "library" | "chat" | "graph" | "settings";
  href: string;
  /** Sidebar / toolbar title (≤15 chars, never the app name). // HIG: toolbars */
  title: string;
  /** Tab bar label: one word. // HIG: tab-bars */
  tabLabel: string;
  symbol: string;
  shortcut: string;
}

export const SECTIONS: Section[] = [
  { id: "library", href: "/library", title: "Kütüphane", tabLabel: "Kütüphane", symbol: "doc.on.doc", shortcut: "1" },
  { id: "chat", href: "/chat", title: "Sohbet", tabLabel: "Sohbet", symbol: "bubble.left.and.text.bubble.right", shortcut: "2" },
  { id: "graph", href: "/graph", title: "Bilgi Grafiği", tabLabel: "Grafik", symbol: "point.3.connected.trianglepath.dotted", shortcut: "3" },
  { id: "settings", href: "/settings", title: "Ayarlar", tabLabel: "Ayarlar", symbol: "gearshape", shortcut: "4" },
];

export const SEARCH = { href: "/search", title: "Arama", symbol: "magnifyingglass" };

export function sectionFor(pathname: string): Section | undefined {
  return SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
}
