import type { Config } from "tailwindcss";

/** Triplet tokens accept Tailwind opacity modifiers (bg-blue/20). */
const triplet = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const systemColors = [
  "red", "orange", "yellow", "green", "mint", "teal", "cyan",
  "blue", "indigo", "purple", "pink", "brown", "gray",
] as const;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: ["variant", ["@media (prefers-color-scheme: dark) { &:not([data-theme=light] *) }", "&:is([data-theme=dark] *)"]],
  theme: {
    // Components use semantic tokens only; no raw RGB anywhere else. // HIG: color
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "rgb(255 255 255 / <alpha-value>)", // only for text on accent fill
      ...Object.fromEntries(systemColors.map((c) => [c, triplet(`c-${c}`)])),
      fg: {
        red: triplet("fg-red"),
        orange: triplet("fg-orange"),
        yellow: triplet("fg-yellow"),
        green: triplet("fg-green"),
        blue: triplet("fg-blue"),
        gray: triplet("fg-gray"),
      },
      accent: { DEFAULT: triplet("accent"), fill: triplet("accent-fill"), on: triplet("on-accent") },
      status: {
        processing: triplet("status-processing"),
        done: triplet("status-done"),
        warning: triplet("status-warning"),
        error: triplet("status-error"),
      },
      label: {
        DEFAULT: "var(--label)",
        secondary: "var(--secondary-label)",
        tertiary: "var(--tertiary-label)",
        quaternary: "var(--quaternary-label)",
        placeholder: "var(--placeholder-text)",
      },
      link: "var(--link)",
      separator: { DEFAULT: "var(--separator)", opaque: "var(--opaque-separator)" },
      bg: {
        DEFAULT: "var(--system-background)",
        secondary: "var(--secondary-system-background)",
        tertiary: "var(--tertiary-system-background)",
        grouped: "var(--system-grouped-background)",
        "grouped-secondary": "var(--secondary-system-grouped-background)",
        "grouped-tertiary": "var(--tertiary-system-grouped-background)",
      },
      fill: {
        DEFAULT: "var(--system-fill)",
        secondary: "var(--secondary-system-fill)",
        tertiary: "var(--tertiary-system-fill)",
      },
    },
    fontFamily: {
      sans: ["var(--font-sans)"], // HIG: typography
      mono: ["var(--font-mono)"],
    },
    // Ultralight/Thin/Light deliberately absent. // HIG: typography
    fontWeight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
    extend: {
      screens: { regular: "768px" }, // size class breakpoint // HIG: layout
      minWidth: { hit: "var(--hit)", "hit-min": "var(--hit-min)" },
      minHeight: { hit: "var(--hit)", "hit-min": "var(--hit-min)" },
      maxWidth: { readable: "var(--readable-width)" }, // HIG: layout "readable-width guides"
      width: { sidebar: "var(--sidebar-width)" },
      height: { toolbar: "var(--toolbar-height)", tabbar: "var(--tabbar-height)" },
      spacing: { bezeled: "var(--space-bezeled)", borderless: "var(--space-borderless)" },
      transitionDuration: { fast: "var(--dur-fast)", DEFAULT: "var(--dur)" },
      transitionTimingFunction: { DEFAULT: "var(--ease)" },
      borderRadius: { control: "8px", card: "12px", sheet: "16px" },
    },
  },
  plugins: [],
};

export default config;
