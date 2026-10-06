import { defineConfig, devices } from "@playwright/test";

const port = process.env.AUTH_OUTAGE_APP_PORT || "3319";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth-outage.spec.ts",
  workers: 1,
  timeout: 30_000,
  reporter: "line",
  use: { ...devices["Desktop Chrome"], baseURL, trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/auth-outage-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    env: { ...process.env, AUTH_OUTAGE_APP_PORT: port },
  },
});
