import type { CSSProperties } from "react";
import {
  Ban, Building2, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert,
  CircleCheck, CircleUser, CircleX, Clock, Cpu, Crosshair, Ellipsis, File, FileText, FileType, Files,
  Filter, Folder, FolderPlus, GitBranch, HardDrive, Inbox, Info, Key, LayoutGrid, Lightbulb, List, Lock,
  LogOut, Mail, Map as MapIcon, Maximize2, MessagesSquare, Minus, Monitor, Moon, NotebookText, Package,
  PanelLeft, PanelRight, Palette, Plus, Quote, RotateCw, Search, Settings, Sheet, SquarePen, Sun,
  Trash2, TriangleAlert, Undo2, Upload, User, Users, Waypoints, X, ZoomIn, ZoomOut, ArrowUp, Square, CircleStop,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon — takes an SF Symbol NAME and renders a visually similar, openly licensed glyph (lucide, ISC).
 * SF Symbols' license limits the artwork to apps on Apple platforms, so a public web product keeps
 * the names only as a reference. Never use any symbol as a logo or app icon. // HIG: sf-symbols
 */
const GLYPHS: Record<string, LucideIcon> = {
  "doc.on.doc": Files,
  "bubble.left.and.text.bubble.right": MessagesSquare,
  "point.3.connected.trianglepath.dotted": Waypoints,
  gearshape: Settings,
  magnifyingglass: Search,
  "chevron.backward": ChevronLeft,
  "chevron.forward": ChevronRight,
  "chevron.down": ChevronDown,
  "chevron.up": ChevronUp,
  "sidebar.leading": PanelLeft,
  "sidebar.trailing": PanelRight,
  "square.and.arrow.up": Upload,
  "circle.slash": Ban,
  "checkmark.circle": CircleCheck,
  checkmark: Check,
  "exclamationmark.triangle": TriangleAlert,
  "exclamationmark.circle": CircleAlert,
  "arrow.clockwise": RotateCw,
  "arrow.uturn.backward": Undo2,
  xmark: X,
  "xmark.circle": CircleX,
  "doc.richtext": FileText,
  "doc.plaintext": FileType,
  tablecells: Sheet,
  "text.document": NotebookText,
  "doc.text": FileText,
  doc: File,
  tray: Inbox,
  "text.quote": Quote,
  person: User,
  "person.2": Users,
  "person.crop.circle": CircleUser,
  "building.2": Building2,
  lightbulb: Lightbulb,
  shippingbox: Package,
  calendar: Calendar,
  "info.circle": Info,
  plus: Plus,
  minus: Minus,
  folder: Folder,
  "folder.badge.plus": FolderPlus,
  trash: Trash2,
  ellipsis: Ellipsis,
  "list.bullet": List,
  "line.3.horizontal.decrease": Filter,
  map: MapIcon,
  "square.grid.3x3": LayoutGrid,
  key: Key,
  externaldrive: HardDrive,
  paintpalette: Palette,
  cpu: Cpu,
  "arrow.up.left.and.arrow.down.right": Maximize2,
  clock: Clock,
  lock: Lock,
  envelope: Mail,
  "rectangle.portrait.and.arrow.right": LogOut,
  circle: Circle,
  "arrow.triangle.branch": GitBranch,
  "plus.magnifyingglass": ZoomIn,
  "minus.magnifyingglass": ZoomOut,
  scope: Crosshair,
  "square.and.pencil": SquarePen,
  "stop.circle": CircleStop,
  "sun.max": Sun,
  moon: Moon,
  display: Monitor,
};

/** Inner glyphs for enclosed filled symbols like "arrow.up.circle.fill". // HIG: sf-symbols "Design Variants" */
const ENCLOSED_FILL: Record<string, LucideIcon> = {
  "arrow.up": ArrowUp,
  stop: Square,
  checkmark: Check,
  xmark: X,
  plus: Plus,
};

export type SymbolWeight = "regular" | "medium" | "semibold" | "bold";
export type SymbolScale = "small" | "medium" | "large";
export type RenderingMode = "monochrome" | "hierarchical";

export interface IconProps {
  /** SF Symbol name, including variant suffixes: ".fill", ".slash", ".circle", ".circle.fill". */
  name: string;
  /** Match the weight of the adjacent text. // HIG: sf-symbols "Weights and Scales" */
  weight?: SymbolWeight;
  /** Size via scale, relative to the surrounding font size. // HIG: sf-symbols */
  scale?: SymbolScale;
  /** Monochrome by default; hierarchical adds depth. // HIG: sf-symbols "Rendering modes" */
  rendering?: RenderingMode;
  /** 0–1. Variable color is for a changing value (e.g. capacity), never for depth. // HIG: sf-symbols */
  variableValue?: number;
  /** Accessible name. Omit for decorative icons next to text. // HIG: accessibility */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const STROKE: Record<SymbolWeight, number> = { regular: 1.75, medium: 2, semibold: 2.25, bold: 2.5 };
const SIZE: Record<SymbolScale, string> = { small: "0.95em", medium: "1.2em", large: "1.5em" };

function a11y(label?: string) {
  return label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
}

export function Icon({
  name, weight = "regular", scale = "medium", rendering = "monochrome", variableValue, label, className = "", style,
}: IconProps) {
  const size = SIZE[scale];
  const strokeWidth = STROKE[weight];
  const boxStyle: CSSProperties = { width: size, height: size, flex: "none", ...style };

  // Variable color: bars light up proportionally to the value.
  if (variableValue !== undefined) {
    const lit = Math.round(Math.max(0, Math.min(1, variableValue)) * 4);
    return (
      <svg viewBox="0 0 24 24" style={boxStyle} className={className} {...a11y(label)}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={3 + i * 5} y={18 - i * 4} width={3.2} height={3 + i * 4} rx={1}
            fill="currentColor" opacity={i < lit ? 1 : 0.25} />
        ))}
      </svg>
    );
  }

  // Enclosed + filled: solid disc with a knocked-out inner glyph.
  if (name.endsWith(".circle.fill")) {
    const inner = ENCLOSED_FILL[name.replace(/\.circle\.fill$/, "")];
    if (inner) {
      const Inner = inner;
      return (
        <span style={{ ...boxStyle, background: "currentColor", borderRadius: "999px", display: "inline-grid", placeItems: "center" }}
          className={className} {...a11y(label)}>
          <Inner style={{ width: "62%", height: "62%", color: "rgb(var(--on-accent))" }} strokeWidth={2.75}
            fill={name.startsWith("stop") ? "currentColor" : "none"} aria-hidden />
        </span>
      );
    }
  }

  const isFill = name.endsWith(".fill");
  const isSlash = name.endsWith(".slash");
  const base = name.replace(/\.(fill|slash)$/, "");
  const Glyph = GLYPHS[base] ?? GLYPHS[base.replace(/\.circle$/, "")] ?? Circle;
  const filled = isFill || rendering === "hierarchical";

  return (
    <span style={{ ...boxStyle, position: "relative", display: "inline-block" }} className={className} {...a11y(label)}>
      <Glyph style={{ width: "100%", height: "100%" }} strokeWidth={strokeWidth}
        fill={filled ? "currentColor" : "none"} fillOpacity={isFill ? 0.28 : 0.15} aria-hidden />
      {isSlash && (
        // Unavailable state. // HIG: sf-symbols "Design Variants" (.slash)
        <svg viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }} aria-hidden>
          <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={strokeWidth + 0.5} strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
