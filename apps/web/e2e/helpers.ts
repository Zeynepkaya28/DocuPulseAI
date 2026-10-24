import type { Page } from "@playwright/test";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WORKER_SECRET = process.env.WORKER_SECRET ?? "dev-worker-secret";
export const FIXTURE_TITLE = "Roket_Raporu_2024_v3";
export const QUEUES = ["document_ingest", "chunk_embed", "chunk_extract", "graph_write"];

/** Local stand-in for Supabase Cron: drain all queues. */
export async function drainQueues(page: Page) {
  for (let round = 0; round < 15; round++) {
    let work = 0;
    for (const q of QUEUES) {
      const r = await page.request.post(`${API}/internal/workers/${q}`, { headers: { "X-Worker-Secret": WORKER_SECRET } });
      const body = await r.json();
      work += (body.processed ?? 0) + (body.failed ?? 0);
    }
    if (work === 0) return;
  }
}

/** Supabase access token from the logged-in page's localStorage. */
export async function accessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    return key ? JSON.parse(localStorage.getItem(key)!).access_token : "";
  });
}

export const isCompact = (page: Page) => (page.viewportSize()?.width ?? 1024) < 768;

export async function shot(page: Page, project: string, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png` });
}
