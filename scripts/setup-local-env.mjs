// Writes .env (api) and apps/web/.env.local from `supabase status` after `npx supabase start`.
// Local development only; both files are gitignored.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const raw = execSync("npx supabase status -o env", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const st = Object.fromEntries(
  raw.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }),
);

const example = readFileSync(join(root, ".env.example"), "utf8");
const values = {
  NEXT_PUBLIC_SUPABASE_URL: st.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: st.ANON_KEY,
  SUPABASE_URL: st.API_URL,
  SUPABASE_SERVICE_ROLE_KEY: st.SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: st.JWT_SECRET,
  SUPABASE_DB_URL: st.DB_URL,
  WORKER_SECRET: "dev-worker-secret",
};

const fill = (text, keepExisting) =>
  text.replace(/^([A-Z_]+)=(.*)$/gm, (line, k, v) => {
    if (keepExisting?.[k]) return `${k}=${keepExisting[k]}`;
    return values[k] !== undefined ? `${k}=${values[k]}` : line;
  });

const parse = (file) =>
  existsSync(file)
    ? Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=.+/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1)]))
    : {};

// Keep user-provided secrets such as OPENAI_API_KEY, refresh Supabase values.
for (const file of [join(root, ".env"), join(root, "apps/web/.env.local")]) {
  const keep = parse(file);
  for (const k of Object.keys(values)) delete keep[k];
  writeFileSync(file, fill(example, keep));
  console.log(`wrote ${file}`);
}
