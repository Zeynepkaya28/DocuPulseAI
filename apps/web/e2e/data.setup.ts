import { expect, test as setup } from "@playwright/test";
import path from "node:path";
import { FIXTURE_TITLE, drainQueues } from "./helpers";

// Local seed user from supabase/seed.sql (never exists in production).
const EMAIL = "alice@docupulse.test";
const PASSWORD = "docupulse-dev-1";

setup("log in, upload fixture document through the UI, run the pipeline", async ({ page }) => {
  await page.goto("/login");
  // Keyboard-only sign in. // HIG: accessibility
  await page.getByLabel("E-posta").fill(EMAIL);
  await page.getByLabel("Parola").fill(PASSWORD);
  await page.getByLabel("Parola").press("Enter");
  await expect(page).toHaveURL(/\/library/);
  await page.context().storageState({ path: "e2e/.auth/alice.json" });

  const table = page.getByRole("table", { name: "Dokümanlar" });
  if (!(await table.getByText(FIXTURE_TITLE).count())) {
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", `${FIXTURE_TITLE}.md`));
    await expect(page.getByText(/Hazır|Sıraya alındı|1\/5/).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(6_000); // undo window (5 s) before processing starts
    await drainQueues(page);
    await expect(page.getByText("Hazır").first()).toBeVisible({ timeout: 20_000 });
  }
});
