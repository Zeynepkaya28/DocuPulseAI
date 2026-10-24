import { test as teardown } from "@playwright/test";
import { API, FIXTURE_TITLE, accessToken } from "./helpers";

teardown("delete the fixture document", async ({ page }) => {
  await page.goto("/library");
  const token = await accessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const docs: { id: string; title: string }[] = await (await page.request.get(`${API}/documents`, { headers })).json();
  for (const d of docs.filter((x) => x.title === FIXTURE_TITLE)) {
    await page.request.delete(`${API}/documents/${d.id}`, { headers });
  }
});
