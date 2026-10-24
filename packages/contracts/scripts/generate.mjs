#!/usr/bin/env node
/**
 * Generates TypeScript types and Pydantic models from schemas/contracts.json,
 * so web and api share one source of truth.
 *   node scripts/generate.mjs          → write files
 *   node scripts/generate.mjs --check  → fail if generated files are stale (CI)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = JSON.parse(readFileSync(join(root, "schemas/contracts.json"), "utf8"));
const defs = spec.definitions;
const HEADER = "AUTO-GENERATED from packages/contracts/schemas/contracts.json — do not edit by hand.";

// ── TypeScript ────────────────────────────────────────────
function tsType(s) {
  if (s.$ref) return s.$ref;
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  switch (s.type) {
    case "string": return "string";
    case "integer":
    case "number": return "number";
    case "boolean": return "boolean";
    case "array": return `${wrap(tsType(s.items))}[]`;
    default: return "unknown";
  }
}
const wrap = (t) => (t.includes("|") ? `(${t})` : t);

function genTs() {
  const out = [`// ${HEADER}`, ""];
  for (const [k, v] of Object.entries(spec.constants ?? {})) {
    out.push(`export const ${k} = ${JSON.stringify(v)} as const;`);
  }
  out.push("");
  for (const [name, s] of Object.entries(defs)) {
    if (s.enum) {
      out.push(`export type ${name} = ${tsType(s)};`);
      out.push(`export const ${name}Values = ${JSON.stringify(s.enum)} as const;`, "");
      continue;
    }
    const req = new Set(s.required ?? []);
    out.push(`export interface ${name} {`);
    for (const [p, ps] of Object.entries(s.properties)) {
      const t = tsType(ps) + (ps.nullable ? " | null" : "");
      out.push(`  ${p}${req.has(p) ? "" : "?"}: ${t};`);
    }
    out.push("}", "");
  }
  for (const [name, members] of Object.entries(spec.unions ?? {})) {
    out.push(`export type ${name} = ${members.join(" | ")};`, "");
  }
  return out.join("\n");
}

// ── Python (Pydantic v2) ──────────────────────────────────
function pyType(s) {
  if (s.$ref) return s.$ref;
  if (s.const !== undefined) return `Literal[${JSON.stringify(s.const)}]`;
  if (s.enum) return `Literal[${s.enum.map((v) => JSON.stringify(v)).join(", ")}]`;
  switch (s.type) {
    case "string": return "str";
    case "integer": return "int";
    case "number": return "float";
    case "boolean": return "bool";
    case "array": return `list[${pyType(s.items)}]`;
    default: return "Any";
  }
}

function genPy() {
  const out = [
    `"""${HEADER}"""`,
    "from __future__ import annotations",
    "",
    "from typing import Annotated, Any, Literal, Union",
    "",
    "from pydantic import BaseModel, Field",
    "",
  ];
  for (const [k, v] of Object.entries(spec.constants ?? {})) {
    out.push(`${k}: tuple[str, ...] = ${JSON.stringify(v).replace(/^\[/, "(").replace(/\]$/, ",)")}`);
  }
  out.push("");
  const models = [];
  for (const [name, s] of Object.entries(defs)) {
    if (s.enum) {
      out.push(`${name} = ${pyType(s)}`, "");
      continue;
    }
    models.push(name);
    const req = new Set(s.required ?? []);
    out.push("", `class ${name}(BaseModel):`);
    for (const [p, ps] of Object.entries(s.properties)) {
      let t = pyType(ps);
      if (ps.const !== undefined) {
        out.push(`    ${p}: ${t} = ${JSON.stringify(ps.const)}`);
      } else if (req.has(p)) {
        out.push(`    ${p}: ${t}${ps.nullable ? " | None" : ""}`);
      } else if (ps.type === "array") {
        out.push(`    ${p}: ${t} = Field(default_factory=list)`);
      } else if (ps.type === "boolean") {
        out.push(`    ${p}: ${t} = False`);
      } else if (ps.type === "integer" && !ps.nullable) {
        out.push(`    ${p}: ${t} = 0`);
      } else {
        out.push(`    ${p}: ${t} | None = None`);
      }
    }
    out.push("");
  }
  for (const [name, members] of Object.entries(spec.unions ?? {})) {
    out.push("", `${name} = Annotated[Union[${members.join(", ")}], Field(discriminator="type")]`);
  }
  out.push("", ...models.map((m) => `${m}.model_rebuild()`), "");
  return out.join("\n");
}

const targets = [
  [join(root, "ts/index.ts"), genTs()],
  // Written inside apps/api so the Vercel Python project (Root Directory: apps/api) can import it.
  [join(root, "../../apps/api/app/contracts.py"), genPy()],
];

const check = process.argv.includes("--check");
let stale = false;
for (const [file, content] of targets) {
  if (check) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== content) {
      console.error(`stale: ${file}`);
      stale = true;
    }
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${file}`);
  }
}
if (stale) process.exit(1);
