import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { BROWSER_FIXTURE_SPECS, normalizeSpecPath, scenarioForSpec } from "./e2e-scenarios.mjs";

const pilotEnv = {
  ...process.env,
  SUPABASE_TELEMETRY: "false",
  FLASH_RUNTIME_SCOPE: "pilot",
  APP_ORIGIN: process.env.APP_ORIGIN || "http://127.0.0.1:3000",
  HEALTHCHECK_SECRET: process.env.HEALTHCHECK_SECRET || "local-s22-health-secret",
};

function commandLabel(command, args) {
  return [command, ...args].join(" ");
}

export function splitPlaywrightArgs(args) {
  const specArgs = args.filter((argument) => /(?:^|[\\/])[^\\/]+\.spec\.ts$/.test(argument));
  const controlArgs = args.filter((argument) => !/(?:^|[\\/])[^\\/]+\.spec\.ts$/.test(argument));
  return { specArgs, controlArgs };
}

export function groupSpecsByScenario(specArgs) {
  const groups = new Map();
  const unprepared = [];

  for (const spec of specArgs) {
    const normalized = normalizeSpecPath(spec);
    const scenario = scenarioForSpec(normalized);
    if (!scenario && !BROWSER_FIXTURE_SPECS.includes(normalized)) {
      unprepared.push(spec);
      continue;
    }
    if (!scenario) continue;
    const group = groups.get(scenario) ?? [];
    group.push(normalized);
    groups.set(scenario, group);
  }

  return { groups, unprepared };
}

function run(command, args, options = {}) {
  const env = { ...pilotEnv, ...(options.env ?? {}) };
  process.stdout.write(`\n$ ${commandLabel(command, args)}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      // CLI start prints local credentials; keep them out of test logs.
      stdio:
        command === "npx" && args[0] === "supabase" && args[1] === "start"
          ? ["inherit", "ignore", "inherit"]
          : "inherit",
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${commandLabel(command, args)} terminó con ${signal ? `señal ${signal}` : `código ${code}`}.`,
        ),
      );
    });
  });
}

async function prepareScenario(scenario) {
  await run("npm", ["run", "supabase:fixture", "--", "--scenario", scenario, "--clean"]);
  await run("npx", [
    "supabase",
    "db",
    "reset",
    "--local",
    ...(process.env.SUPABASE_TEST_WORKDIR ? ["--workdir", process.env.SUPABASE_TEST_WORKDIR] : []),
  ]);
  if (scenario === "e01") {
    await run("npm", ["run", "supabase:dictionary:load"]);
  }
  await run("npm", ["run", "supabase:fixture", "--", "--scenario", scenario]);
}

async function cleanScenario(scenario) {
  await run("npm", ["run", "supabase:fixture", "--", "--scenario", scenario, "--clean"]);
}

async function runBrowserFixture(controlArgs, specs) {
  await run("npm", ["run", "supabase:browser:setup"]);
  await run("npm", ["run", "test:e2e:raw", "--", ...controlArgs, ...specs]);
}

export async function runSelectedE2E(args) {
  const { specArgs, controlArgs } = splitPlaywrightArgs(args);
  if (specArgs.length === 0) {
    await run("npm", ["run", "test:e2e:raw", "--", ...args]);
    return;
  }

  const { groups, unprepared } = groupSpecsByScenario(specArgs);
  const browserSpecs = specArgs.filter((spec) =>
    BROWSER_FIXTURE_SPECS.includes(normalizeSpecPath(spec)),
  );
  if (groups.size > 0 || browserSpecs.length > 0) {
    await run("npx", [
      "supabase",
      "start",
      ...(process.env.SUPABASE_TEST_WORKDIR
        ? ["--workdir", process.env.SUPABASE_TEST_WORKDIR]
        : []),
    ]);
  }

  const failedScenarios = [];
  for (const [scenario, specs] of groups) {
    await prepareScenario(scenario);
    try {
      const scenarioEnv = {
        ...(scenario === "e01" ? { FLASH_RATE_LIMIT_BURST: "30" } : {}),
        PLAYWRIGHT_JSON_OUTPUT_FILE: `output/playwright/competitive-${scenario}.json`,
      };
      await run(
        "npm",
        ["run", "test:e2e:raw", "--", "--reporter=line,json", ...controlArgs, ...specs],
        {
          env: scenarioEnv,
        },
      );
      if (process.env.E2E_COMPETITIVE_PROJECTIONS === "1") {
        await run(process.execPath, [
          "scripts/check-competitive-projections.mjs",
          "--scenario",
          scenario,
        ]);
      }
    } catch (error) {
      if (process.env.E2E_CONTINUE_ON_FAILURE !== "1") throw error;
      failedScenarios.push(scenario);
      console.error(error.message);
    } finally {
      await cleanScenario(scenario);
    }
  }

  if (browserSpecs.length > 0) {
    await runBrowserFixture(controlArgs, browserSpecs.map(normalizeSpecPath));
  }

  if (unprepared.length > 0) {
    await run("npm", ["run", "test:e2e:raw", "--", ...controlArgs, ...unprepared]);
  }
  if (failedScenarios.length)
    throw new Error(`Escenarios E2E fallidos: ${failedScenarios.join(", ")}`);
}

async function main() {
  await runSelectedE2E(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
