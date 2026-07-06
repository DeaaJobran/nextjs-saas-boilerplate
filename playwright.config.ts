import { defineConfig, devices } from "@playwright/test";

const pgliteDataDir =
  process.env.PGLITE_DATA_DIR ?? `.local/pglite-playwright-${Date.now()}`;
const databaseEnv = process.env.DATABASE_URL
  ? { DATABASE_URL: process.env.DATABASE_URL }
  : { PGLITE_DATA_DIR: pgliteDataDir };

if (!process.env.DATABASE_URL) {
  process.env.PGLITE_DATA_DIR = pgliteDataDir;
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "pnpm --filter @nextjs-saas/web exec next start --hostname 127.0.0.1",
    env: {
      ADMIN_SESSION_TOKEN: "playwright-admin",
      ...databaseEnv,
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
