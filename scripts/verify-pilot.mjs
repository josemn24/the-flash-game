import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputDirectory = path.join("output", "s22");
const logDirectory = path.join(outputDirectory, "logs");

const e2eByScenario = {
  portal: ["e2e/admin-portal.spec.ts"],
  s02: ["e2e/s02-rooms.spec.ts"],
  s03: ["e2e/s03-flash.spec.ts"],
  e01: ["e2e/e01-mini-wordle.spec.ts"],
  e02: ["e2e/e02-logic-code.spec.ts"],
  e03: ["e2e/e03-progressive-clues.spec.ts"],
  e04: ["e2e/e04-matching.spec.ts"],
  s04: ["e2e/s04-recovery.spec.ts"],
  s06: ["e2e/s06-ranking.spec.ts"],
  s07: ["e2e/s07-history-review.spec.ts"],
  s10: ["e2e/s10-season.spec.ts"],
  s11: ["e2e/s11-editorial.spec.ts"],
  s12: ["e2e/s12-calendar.spec.ts"],
};

const pilotEnv = {
  ...process.env,
  SUPABASE_TELEMETRY: "false",
  FLASH_RUNTIME_SCOPE: "pilot",
  APP_ORIGIN: process.env.APP_ORIGIN || "http://127.0.0.1:3000",
  HEALTHCHECK_SECRET: process.env.HEALTHCHECK_SECRET || "local-s22-health-secret",
  EXPECTED_SCHEMA_REVISION:
    process.env.EXPECTED_SCHEMA_REVISION || "20260917103100_e04_matching_validation",
};

async function run(label, command, args, options = {}) {
  const logPath = path.join(logDirectory, `${label.replaceAll(/[^a-z0-9._-]/gi, "-")}.log`);
  try {
    const result = await execFileAsync(command, args, {
      cwd: process.cwd(),
      env: pilotEnv,
      maxBuffer: 32 * 1024 * 1024,
      ...options,
    });
    await writeFile(logPath, redact(`${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}`));
    process.stdout.write(`✓ ${label}\n`);
    return result;
  } catch (error) {
    const stdout = error?.stdout ?? "";
    const stderr = error?.stderr ?? "";
    const safeOutput = redact(`${stdout}\n${stderr}`);
    await writeFile(logPath, safeOutput);
    process.stderr.write(`\n✗ ${label}\n${safeOutput}\n`);
    throw error;
  }
}

function redact(value) {
  return String(value)
    .replaceAll(/(SUPABASE_[A-Z0-9_]+|NEXT_PUBLIC_SUPABASE_[A-Z0-9_]+|CALENDAR_TICK_SECRET|HEALTHCHECK_SECRET|APP_ORIGIN)=\S+/g, "$1=REDACTED")
    .replaceAll(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, "SUPABASE_KEY_REDACTED")
    .replaceAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "JWT_REDACTED")
    .replaceAll(/postgres(?:ql)?:\/\/\S+/g, "postgresql://DB_URL_REDACTED");
}

await mkdir(logDirectory, { recursive: true, mode: 0o700 });

try {
  await run("supabase-start", "npx", ["supabase", "start"]);
  await run("schema-security", "npm", ["run", "supabase:schema:test"]);
  await run("dictionary-load", "npm", ["run", "supabase:dictionary:load"]);
  await run("unit-tests", "npm", ["test"], {
    env: { ...pilotEnv, FLASH_RUNTIME_SCOPE: "test" },
  });
  await run("typecheck", "npm", ["run", "typecheck"]);
  await run("type-architecture", "npm", ["run", "type-architecture"]);
  await run("lint", "npm", ["run", "lint"]);
  await run("docs-check", "npm", ["run", "docs:check"]);
  await run("build", "npm", ["run", "build"]);

  for (const [scenario, specs] of Object.entries(e2eByScenario)) {
    await run(`${scenario}-reset`, "npm", ["run", "supabase:db:reset"]);
    await run(`${scenario}-dictionary-load`, "npm", ["run", "supabase:dictionary:load"]);
    await unlink(`output/fixtures/${scenario}.json`).catch(() => undefined);
    await run(`${scenario}-fixture`, "npm", [
      "run",
      "supabase:fixture",
      "--",
      "--scenario",
      scenario,
    ]);
    await run(`${scenario}-integration`, "npm", [
      "run",
      "test:integration:supabase",
      "--",
      "--scenario",
      scenario,
    ]);
    // Integration scenarios are intentionally allowed to mutate domain state.
    // Recreate Auth and PostgreSQL before browser tests so E2E never depends on
    // data left by the preceding scenario stage.
    await run(`${scenario}-e2e-reset`, "npm", ["run", "supabase:db:reset"]);
    await run(`${scenario}-e2e-dictionary-load`, "npm", ["run", "supabase:dictionary:load"]);
    await unlink(`output/fixtures/${scenario}.json`).catch(() => undefined);
    await run(`${scenario}-e2e-fixture`, "npm", [
      "run",
      "supabase:fixture",
      "--",
      "--scenario",
      scenario,
    ]);
    await run(
      `${scenario}-e2e`,
      "npm",
      ["run", "test:e2e", "--", ...specs],
      scenario === "e01" ? { env: { ...pilotEnv, FLASH_RATE_LIMIT_BURST: "30" } } : {},
    );
  }

  await run("browser-fixture", "npm", ["run", "supabase:browser:setup"]);
  await run("browser-layout-e2e", "npm", ["run", "test:e2e", "--", "e2e/flash-layout.spec.ts"]);

  await run("dictionary-check", "npm", ["run", "dictionary:check"]);
  await run("backup-restore", "node", ["scripts/s22-backup-restore.mjs"]);
  process.stdout.write(`S22 pilot verification complete. Logs: ${logDirectory}\n`);
} catch {
  process.exitCode = 1;
}
