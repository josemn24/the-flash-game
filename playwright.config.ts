import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

function parseLocalStatus() {
  try {
    const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_TELEMETRY: "false" },
    });
    return Object.fromEntries(
      output.split("\n").flatMap((line) => {
        const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
        if (!match) return [];
        return [[match[1], match[2].replace(/^"|"$/g, "")]];
      }),
    );
  } catch {
    return {};
  }
}

const localStatus = parseLocalStatus();
const isPwaE2e = process.env.PWA_E2E === "1";
const e2ePort = isPwaE2e
  ? process.env.PWA_E2E_PORT || "3001"
  : process.env.E2E_PORT || "3000";
const e2eBaseURL = `http://127.0.0.1:${e2ePort}`;
const localEnv = {
  ...process.env,
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL || localStatus.DB_URL || "",
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || localStatus.API_URL || "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    localStatus.PUBLISHABLE_KEY ||
    localStatus.ANON_KEY ||
    "",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY || localStatus.SERVICE_ROLE_KEY || "",
  CALENDAR_TICK_SECRET: process.env.CALENDAR_TICK_SECRET || "local-s12-calendar-secret",
  FLASH_RUNTIME_SCOPE: process.env.FLASH_RUNTIME_SCOPE || "pilot",
  APP_ORIGIN: process.env.APP_ORIGIN || e2eBaseURL,
  HEALTHCHECK_SECRET: process.env.HEALTHCHECK_SECRET || "local-s22-health-secret",
  // E2E scenarios intentionally exercise recovery/retry sequences; keep the
  // production default of 5 while giving the test process a bounded headroom.
  FLASH_RATE_LIMIT_BURST: process.env.FLASH_RATE_LIMIT_BURST || "30",
  EXPECTED_SCHEMA_REVISION:
    process.env.EXPECTED_SCHEMA_REVISION || "20260922180514_declarative_sync",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: e2eBaseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: isPwaE2e
      ? `npm run start -- --hostname 127.0.0.1 --port ${e2ePort}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseURL,
    reuseExistingServer: isPwaE2e ? false : process.env.FLASH_RUNTIME_SCOPE !== "pilot",
    timeout: 120_000,
    env: localEnv,
  },
});
