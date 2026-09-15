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
const localEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || localStatus.API_URL || "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    localStatus.PUBLISHABLE_KEY ||
    localStatus.ANON_KEY ||
    "",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: localEnv,
  },
});
