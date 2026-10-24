// Local stand-in for Supabase Cron: drains all queues by calling the worker endpoints until idle.
//   npm run worker:tick            (once until idle)
//   npm run worker:tick -- --watch (keep polling every 3 s)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const env = existsSync(join(root, ".env"))
  ? Object.fromEntries(readFileSync(join(root, ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1)]))
  : {};
const API = process.env.API_URL ?? env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SECRET = process.env.WORKER_SECRET ?? env.WORKER_SECRET ?? "dev-worker-secret";
const QUEUES = ["document_ingest", "chunk_embed", "chunk_extract", "graph_write"];
const watch = process.argv.includes("--watch");

async function tick() {
  let work = 0;
  for (const q of QUEUES) {
    const r = await fetch(`${API}/internal/workers/${q}`, { method: "POST", headers: { "X-Worker-Secret": SECRET } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) console.error(q, r.status, body);
    else if (body.processed || body.failed) console.log(q, body);
    work += (body.processed ?? 0) + (body.failed ?? 0);
  }
  return work;
}

do {
  while ((await tick()) > 0) { /* drain */ }
  if (watch) await new Promise((r) => setTimeout(r, 3000));
} while (watch);
