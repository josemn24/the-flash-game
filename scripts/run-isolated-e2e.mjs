import { E2E_BY_SCENARIO, scenarioForSpec } from "./e2e-scenarios.mjs";
import { cp, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

const workdir = await mkdtemp(path.join(os.tmpdir(), "flash-competitive-e2e-"));
const projectId = `flash-competitive-e2e-${randomUUID().slice(0, 8)}`;
const env = {
  ...process.env,
  SUPABASE_TELEMETRY: "false",
  SUPABASE_TEST_WORKDIR: workdir,
  SUPABASE_DB_CONTAINER: `supabase_db_${projectId}`,
  E2E_PORT: "3300",
  E2E_CONTINUE_ON_FAILURE: "1",
  APP_ORIGIN: "http://127.0.0.1:3300",
  FLASH_RUNTIME_SCOPE: "pilot",
};
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
])
  delete env[key];
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} terminó con ${signal ?? code}`)),
    );
  });
}
const requested = process.argv.slice(2);
const specs = requested.length
  ? requested
  : [
      "format-contracts",
      "format-contracts-pyramid",
      "s03",
      "s04",
      "s05",
      "narrative",
      "narrative-interactive",
      "e01",
      "e02",
      "e03",
      "e04",
      "e05",
      "e06",
      "e10",
      "f08",
      "f16",
      "f18",
      "f19",
      "s06",
      "s07",
      "s14",
      "s15",
      "s11",
      "s17",
    ].flatMap((scenario) => E2E_BY_SCENARIO[scenario]);
const savedFixtures = new Map();
for (const scenario of new Set(specs.map(scenarioForSpec).filter(Boolean))) {
  const fixturePath = path.join("output", "fixtures", `${scenario}.json`);
  try {
    savedFixtures.set(fixturePath, await readFile(fixturePath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
try {
  await cp("supabase", path.join(workdir, "supabase"), {
    recursive: true,
    filter: (source) => ![".temp", ".branches"].includes(path.basename(source)),
  });
  const configPath = path.join(workdir, "supabase", "config.toml");
  const config = (await readFile(configPath, "utf8"))
    .replace(/^project_id = .*$/m, `project_id = "${projectId}"`)
    .replaceAll("5432", "5532")
    .replaceAll("http://127.0.0.1:3000", env.APP_ORIGIN)
    .replaceAll("http://localhost:3000", env.APP_ORIGIN);
  await writeFile(configPath, config);
  console.log(`Stack E2E aislado: ${projectId}; API :55321; aplicación :3300.`);
  await run(process.execPath, ["scripts/run-e2e.mjs", ...specs]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const [fixturePath, content] of savedFixtures)
    await writeFile(fixturePath, content, { mode: 0o600 });
  try {
    await run("npx", ["supabase", "stop", "--no-backup", "--workdir", workdir]);
    await rm(workdir, { recursive: true, force: true });
  } catch (error) {
    console.error(
      `No se pudo cerrar el stack ${projectId}: ${error.message}. Directorio: ${workdir}`,
    );
    process.exitCode = 1;
  }
}
