import { defineConfig, devices } from "@playwright/test";

const port = process.env.LOCAL_REHEARSALS_E2E_PORT || process.env.LOCAL_PYRAMID_E2E_PORT || "3301";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /local-(?:pyramid|flash|survival)-rehearsal\.spec\.ts/,
  timeout: 120_000,
  fullyParallel: false,
  reporter: "line",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: { ...devices["Desktop Chrome"], baseURL, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/demo/flash-pop/desafios/tabarnia-challenge-05`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      FLASH_NEXT_DIST_DIR: process.env.FLASH_NEXT_DIST_DIR || ".next/local-rehearsals-e2e",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_DB_URL: "",
    },
  },
});
