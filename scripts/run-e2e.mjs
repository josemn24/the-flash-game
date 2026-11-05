import { execFileSync, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
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

function localSupabaseStatus() {
  const args = ["supabase", "status", "-o", "env"];
  if (process.env.SUPABASE_TEST_WORKDIR) args.push("--workdir", process.env.SUPABASE_TEST_WORKDIR);
  const output = execFileSync("npx", args, { encoding: "utf8", env: pilotEnv });
  return Object.fromEntries(
    output.split("\n").flatMap((line) => {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match) return [];
      return [[match[1], match[2].replace(/^\"|\"$/g, "")]];
    }),
  );
}

async function fixtureAuthAccount(scenario) {
  const fixtureScenario = scenario === "rehearsals" ? "betavip" : scenario;
  const fixturePath = `output/fixtures/${fixtureScenario}.json`;
  let fixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer el fixture de Auth para ${scenario} (${fixturePath}).`, {
      cause: error,
    });
  }

  const account = Object.values(fixture.users ?? {}).find(
    (candidate) =>
      candidate && typeof candidate.email === "string" && typeof candidate.password === "string",
  );
  if (!account) throw new Error(`El fixture ${fixtureScenario} no contiene una cuenta de Auth.`);
  return account;
}

async function waitForSupabaseAuth(status, scenario) {
  const apiUrl = status.API_URL;
  const apiKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (!apiUrl || !apiKey)
    throw new Error("No se pudo resolver la URL/clave local de Supabase Auth.");

  const healthEndpoint = new URL("/auth/v1/health", apiUrl);
  const tokenEndpoint = new URL("/auth/v1/token?grant_type=password", apiUrl);
  const userEndpoint = new URL("/auth/v1/user", apiUrl);
  if (
    ![healthEndpoint, tokenEndpoint, userEndpoint].every((endpoint) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname),
    )
  )
    throw new Error("La comprobación de readiness solo admite Supabase local.");

  const account = await fixtureAuthAccount(scenario);
  const startedAt = Date.now();
  const deadline = Date.now() + 30_000;
  let lastFailure = "sin respuesta";
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const attemptStartedAt = Date.now();
    let stage = "health";
    let stageStartedAt = attemptStartedAt;
    try {
      const healthResponse = await fetch(healthEndpoint, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(Math.min(2_000, Math.max(1, deadline - Date.now()))),
      });
      await healthResponse.text();
      if (!healthResponse.ok)
        throw new Error(`Auth health respondió HTTP ${healthResponse.status}.`);
      const healthMs = Date.now() - stageStartedAt;

      stage = "sign-in";
      stageStartedAt = Date.now();
      const tokenResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { apikey: apiKey, "content-type": "application/json" },
        body: JSON.stringify({ email: account.email, password: account.password }),
        signal: AbortSignal.timeout(Math.min(5_000, Math.max(1, deadline - Date.now()))),
      });
      if (!tokenResponse.ok) {
        await tokenResponse.body?.cancel();
        const failure = new Error(`Auth sign-in respondió HTTP ${tokenResponse.status}.`);
        if (tokenResponse.status === 400 || tokenResponse.status === 401)
          Object.assign(failure, { retryable: false });
        throw failure;
      }

      const session = await tokenResponse.json();
      if (typeof session.access_token !== "string" || typeof session.user?.id !== "string")
        throw new Error("Auth sign-in no devolvió una sesión válida.");
      const signInMs = Date.now() - stageStartedAt;

      stage = "getUser";
      stageStartedAt = Date.now();
      const userResponse = await fetch(userEndpoint, {
        headers: {
          apikey: apiKey,
          authorization: `Bearer ${session.access_token}`,
        },
        signal: AbortSignal.timeout(Math.min(5_000, Math.max(1, deadline - Date.now()))),
      });
      if (!userResponse.ok) {
        await userResponse.body?.cancel();
        const failure = new Error(`Auth getUser respondió HTTP ${userResponse.status}.`);
        if (userResponse.status === 400 || userResponse.status === 401)
          Object.assign(failure, { retryable: false });
        throw failure;
      }

      const user = await userResponse.json();
      if (user.id !== session.user.id) throw new Error("Auth getUser devolvió otro usuario.");
      const getUserMs = Date.now() - stageStartedAt;

      const elapsedMs = Date.now() - startedAt;
      console.log(
        `Supabase Auth lista para ${scenario}: health ${healthMs} ms, sign-in ${signInMs} ms y getUser ${getUserMs} ms (intento ${attempt}, ${elapsedMs} ms hasta quedar lista).`,
      );
      return;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
      const stageMs = Date.now() - stageStartedAt;
      console.warn(
        `[e2e auth readiness] ${scenario}: ${stage} falló tras ${stageMs} ms en el intento ${attempt} (${Date.now() - startedAt} ms total): ${lastFailure}`,
      );
      if (error?.retryable === false) {
        throw new Error(
          `Falló la cuenta del fixture durante el preflight de Auth: ${lastFailure}`,
          {
            cause: error,
          },
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(1_500, attempt * 500)));
  }
  throw new Error(
    `Supabase Auth no completó health, sign-in y getUser en 30 s para ${scenario}: ${lastFailure}`,
  );
}

async function prepareScenario(scenario) {
  if (scenario === "betavip" || scenario === "tabarnia") {
    await run(process.execPath, [`scripts/seed-${scenario}.mjs`]);
    return;
  }
  if (scenario === "rehearsals") {
    await run("npx", [
      "supabase",
      "db",
      "reset",
      "--local",
      ...(process.env.SUPABASE_TEST_WORKDIR
        ? ["--workdir", process.env.SUPABASE_TEST_WORKDIR]
        : []),
    ]);
    await run(process.execPath, ["scripts/seed-betavip.mjs"]);
    return;
  }
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
  if (["rehearsals", "betavip", "tabarnia"].includes(scenario)) return;
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
  const supabaseStatus = groups.size > 0 ? localSupabaseStatus() : null;

  const failedScenarios = [];
  for (const [scenario, specs] of groups) {
    await prepareScenario(scenario);
    if (["time-trial", "time-trial-connect-pairs"].includes(scenario))
      await run("npm", ["run", "test:integration:supabase", "--", "--scenario", scenario]);
    try {
      if ((process.env.E2E_INTEGRATION_SCENARIOS ?? "").split(",").includes(scenario)) {
        await run("npm", ["run", "test:integration:supabase", "--", "--scenario", scenario]);
        // Command integrations can create publications or attempts. Browser tests
        // need a fresh fixture rather than inheriting those mutations.
        await prepareScenario(scenario);
      }
      if (supabaseStatus) await waitForSupabaseAuth(supabaseStatus, scenario);
      const scenarioEnv = {
        ...(scenario === "e01" ? { FLASH_RATE_LIMIT_BURST: "30" } : {}),
        ...(specs.some((spec) =>
          [
            "e2e/flash-session-conformance.spec.ts",
            "e2e/survival-session-conformance.spec.ts",
            "e2e/time-trial-session-conformance.spec.ts",
            "e2e/time-trial-connect-pairs-session-conformance.spec.ts",
            "e2e/time-trial-timeout-conformance.spec.ts",
            "e2e/alphabet-session-conformance.spec.ts",
            "e2e/pyramid-session-conformance.spec.ts",
          ].includes(spec),
        )
          ? { FLASH_RATE_LIMIT_BURST: "10000" }
          : {}),
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
