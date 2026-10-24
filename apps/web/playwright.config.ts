import { defineConfig, devices } from "@playwright/test";

/**
 * Faz A7 — HIG audit. Test extremes first: the smallest (375 px) and largest (1920 px) widths,
 * in light and dark. // HIG: layout "test extremes first"
 * Needs the local stack: `npx supabase start`, `docker compose up -d neo4j`, `node scripts/setup-local-env.mjs`.
 */
const AUTH = "e2e/.auth/alice.json";

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/hig.json" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /data\.setup\.ts/, teardown: "teardown" },
    { name: "teardown", testMatch: /data\.teardown\.ts/, use: { storageState: AUTH } },
    {
      name: "compact-light",
      dependencies: ["setup"],
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 }, colorScheme: "light", storageState: AUTH },
    },
    {
      name: "compact-dark",
      dependencies: ["setup"],
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 }, colorScheme: "dark", storageState: AUTH },
    },
    {
      name: "regular-light",
      dependencies: ["setup"],
      use: { viewport: { width: 1920, height: 1080 }, colorScheme: "light", storageState: AUTH },
    },
    {
      name: "regular-dark",
      dependencies: ["setup"],
      use: { viewport: { width: 1920, height: 1080 }, colorScheme: "dark", storageState: AUTH },
    },
  ],
  webServer: [
    {
      command: "node ../../scripts/run-api.mjs",
      url: "http://localhost:8000/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npx next dev -p 3000",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
