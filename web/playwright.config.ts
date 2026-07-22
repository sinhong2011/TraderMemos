import { defineConfig, devices } from "@playwright/test";

// E2E smoke against a running app. Prerequisites:
//  - the API running on :8080 with a seeded user (E2E_EMAIL / E2E_PASSWORD)
//  - the web dev server on :5173 (Playwright starts it, or reuses a running one)
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
