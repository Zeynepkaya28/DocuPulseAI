// Static HIG checks for apps/web (Faz A7). Exit code 1 on any finding.
//  1. No hard-coded colors in components — semantic tokens only. // HIG: color
//  2. No Ultralight/Thin/Light weights. // HIG: typography
//  3. No embedded font files; system fonts only. // HIG: typography
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const web = join(import.meta.dirname, "..", "apps", "web");
const SCAN = ["app", "components", "lib", "hooks"];
const ALLOW = new Set(["styles/tokens.css", "tailwind.config.ts"]);

const RULES = [
  { id: "hard-coded-color", re: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(\s*\d|\bhsla?\(\s*\d|\b(?:bg|text|border|fill|stroke)-(?:black|white)\b(?!\/)/g, hig: "color" },
  { id: "light-font-weight", re: /\bfont-(?:thin|extralight|light)\b|fontWeight:\s*["']?(?:100|200|300)\b/g, hig: "typography" },
  { id: "embedded-font", re: /@font-face|next\/font|\.woff2?\b|\.ttf\b|\.otf\b/g, hig: "typography" },
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx?|css)$/.test(name)) yield p;
  }
}

const findings = [];
for (const root of SCAN) {
  for (const file of files(join(web, root))) {
    const rel = relative(web, file).replaceAll("\\", "/");
    if (ALLOW.has(rel)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments
      for (const r of RULES) {
        for (const m of line.matchAll(r.re)) findings.push(`${rel}:${i + 1}  ${r.id} [HIG: ${r.hig}]  ${m[0]}`);
      }
    });
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  console.error(`\n${findings.length} HIG lint finding(s)`);
  process.exit(1);
}
console.log("HIG lint: no hard-coded colors, light weights or embedded fonts");
