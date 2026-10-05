import { defineConfig, devices } from "@playwright/test";

const production = process.env.DESIGN_SYSTEM_E2E_MODE === "production";
const port = process.env.E2E_PORT || (production ? "3112" : "3111");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./e2e",
  testMatch: production
    ? ["design-system-production.spec.ts"]
    : ["design-system.spec.ts", "design-tokens.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: "line",
  use: { ...devices["Desktop Chrome"], baseURL, trace: "retain-on-failure" },
  webServer: {
    command: `npm run ${production ? "start" : "dev"} -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/icons/the-flash-192.png`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      FLASH_NEXT_DIST_DIR:
        process.env.FLASH_NEXT_DIST_DIR ||
        `.next/design-system-${production ? "production" : "development"}`,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_DB_URL: "",
    },
  },
});
