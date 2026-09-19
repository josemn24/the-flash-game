import { createHash, randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);
const fixtureDirectory = path.join("output", "fixtures");
const dbContainer = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";

function usage() {
  return "Uso: npm run supabase:fixture -- --scenario <id> [--clean]";
}

export function parseScenarioArgs(args) {
  let scenarioId = null;
  let clean = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--clean") {
      clean = true;
      continue;
    }
    if (argument === "--scenario") {
      scenarioId = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      throw new Error(usage());
    }
    throw new Error(`Argumento desconocido: ${argument}. ${usage()}`);
  }

  if (!scenarioId || !/^[a-z0-9][a-z0-9-]*$/.test(scenarioId)) {
    throw new Error(`Debes indicar un escenario válido. ${usage()}`);
  }

  return { scenarioId, clean };
}

export function fixturePath(scenarioId) {
  return path.join(fixtureDirectory, `${scenarioId}.json`);
}

export async function fixtureExists(scenarioId) {
  try {
    await access(fixturePath(scenarioId));
    return true;
  } catch {
    return false;
  }
}

export async function readFixture(scenarioId) {
  const outputPath = fixturePath(scenarioId);
  let contents;
  try {
    contents = await readFile(outputPath, "utf8");
  } catch (error) {
    throw new Error(
      `No existe ${outputPath}. Ejecuta primero el fixture del escenario ${scenarioId}.`,
      { cause: error },
    );
  }

  try {
    const fixture = JSON.parse(contents);
    if (fixture?.scenario !== scenarioId || fixture?.version !== 1) {
      throw new Error("versión o escenario incompatibles");
    }
    if (!fixture.users || !fixture.data) {
      throw new Error("faltan usuarios o datos de escenario");
    }
    return fixture;
  } catch (error) {
    throw new Error(`El manifiesto ${outputPath} no es válido: ${error.message}`, {
      cause: error,
    });
  }
}

export async function writeFixture(scenarioId, fixture) {
  await mkdir(fixtureDirectory, { recursive: true, mode: 0o700 });
  await writeFile(fixturePath(scenarioId), `${JSON.stringify(fixture, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function removeFixture(scenarioId) {
  try {
    await unlink(fixturePath(scenarioId));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function deterministicUuid(namespace, label) {
  const hex = createHash("md5").update(`${namespace}:${label}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function sqlUuid(namespace, label) {
  return sqlString(deterministicUuid(namespace, label));
}

function parseEnvOutput(value) {
  return Object.fromEntries(
    value.split("\n").flatMap((line) => {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match) return [];
      const parsed = match[2].replace(/^"|"$/g, "");
      return [[match[1], parsed]];
    }),
  );
}

async function localStatusEnv() {
  try {
    const { stdout } = await execFileAsync("npx", ["supabase", "status", "-o", "env"], {
      env: { ...process.env, SUPABASE_TELEMETRY: "false" },
    });
    return parseEnvOutput(stdout);
  } catch (error) {
    throw new Error(
      "No se pudo leer el estado de Supabase local. Ejecuta `npx supabase start` antes del escenario.",
      { cause: error },
    );
  }
}

function assertLocalUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(`La URL de Supabase no es válida: ${url}`, { cause: error });
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error(
      `El runner solo admite Supabase local; se rechazó la URL no local ${parsed.origin}.`,
    );
  }
}

export async function localSupabaseConfig({ requireServiceRole = false } = {}) {
  const statusEnv = await localStatusEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || statusEnv.API_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    statusEnv.PUBLISHABLE_KEY ||
    statusEnv.ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || statusEnv.SERVICE_ROLE_KEY;

  if (!url || !publishableKey || (requireServiceRole && !serviceRoleKey)) {
    throw new Error(
      "Faltan credenciales locales. `npx supabase status -o env` debe incluir API_URL, PUBLISHABLE_KEY y SERVICE_ROLE_KEY.",
    );
  }
  assertLocalUrl(url);
  return { url, publishableKey, serviceRoleKey, dbContainer };
}

export function dockerSql(sql, container = dbContainer) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${stderr}\n${stdout}`));
    });
    child.stdin.end(sql);
  });
}

export async function resetLocalDatabase() {
  await execFileAsync("npx", ["supabase", "db", "reset", "--local"], {
    env: { ...process.env, SUPABASE_TELEMETRY: "false" },
  });
}

export async function createAuthAccounts(scenario, config) {
  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accounts = {};

  for (const user of scenario.users) {
    const password = `${scenario.id.toUpperCase()}-${randomBytes(18).toString("base64url")}a1!`;
    const email = `fixture-${scenario.id}-${user.label}-${randomBytes(8).toString("hex")}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    });
    if (error || !data.user) {
      throw new Error(`No se pudo crear la cuenta local de ${user.label}.`, { cause: error });
    }

    const client = createClient(config.url, config.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionData, error: sessionError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (sessionError || !sessionData.session) {
      throw new Error(`No se pudo iniciar sesión como ${email}.`, { cause: sessionError });
    }

    const { data: provisioned, error: provisionError } = await client.rpc("provision_player");
    if (provisionError) {
      throw new Error(`No se pudo aprovisionar ${email}.`, { cause: provisionError });
    }
    const row = Array.isArray(provisioned) ? provisioned[0] : provisioned;
    if (!row?.player_id) {
      throw new Error(`La respuesta de provision_player no contiene Player para ${email}.`);
    }

    accounts[user.label] = {
      email,
      password,
      authUserId: data.user.id,
      playerId: row.player_id,
    };
  }

  return accounts;
}

export async function createFixedAuthAccounts(users, config) {
  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accounts = {};

  for (const user of users) {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    });
    if (error || !data.user) {
      throw new Error(`No se pudo crear la cuenta local de ${user.label}.`, { cause: error });
    }

    const client = createClient(config.url, config.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionData, error: sessionError } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (sessionError || !sessionData.session) {
      throw new Error(`No se pudo iniciar sesión como ${user.email}.`, { cause: sessionError });
    }

    const { data: provisioned, error: provisionError } = await client.rpc("provision_player");
    if (provisionError) {
      throw new Error(`No se pudo aprovisionar ${user.email}.`, { cause: provisionError });
    }
    const row = Array.isArray(provisioned) ? provisioned[0] : provisioned;
    if (!row?.player_id) {
      throw new Error(`La respuesta de provision_player no contiene Player para ${user.email}.`);
    }

    accounts[user.label] = {
      email: user.email,
      password: user.password,
      authUserId: data.user.id,
      playerId: row.player_id,
    };
  }

  return accounts;
}

export async function createAuthenticatedClient(config, account) {
  const client = createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error || !data.session) {
    throw new Error(`No se pudo autenticar ${account.email}.`, { cause: error });
  }
  return client;
}

export async function uploadStorageObject(config, { bucket, objectPath, filePath, contentType }) {
  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bytes = await readFile(filePath);
  const { error } = await admin.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`No se pudo cargar ${bucket}/${objectPath}.`, { cause: error });
}

export async function rpc(client, functionName, args) {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw new Error(`RPC ${functionName} falló: ${error.message}`);
  return Array.isArray(data) ? data : [];
}

export async function sqlCount(query, container = dbContainer) {
  const { stdout } = await dockerSql(query, container);
  return Number(stdout.trim());
}

export async function loadScenario(kind, scenarioId) {
  const relativePath =
    kind === "fixture"
      ? `./fixtures/scenarios/${scenarioId}.mjs`
      : `./integration/scenarios/${scenarioId}.mjs`;
  const absolutePath = path.resolve("scripts", relativePath);

  try {
    await access(absolutePath);
  } catch (error) {
    throw new Error(`El escenario ${scenarioId} no está registrado para ${kind}.`, {
      cause: error,
    });
  }

  const imported = await import(pathToFileURL(absolutePath).href);
  const scenario = imported.default ?? imported.scenario;
  if (!scenario || scenario.id !== scenarioId) {
    throw new Error(`El escenario ${scenarioId} no expone un contrato válido para ${kind}.`);
  }
  return scenario;
}

export function assert(condition, message, scenarioId) {
  if (!condition) throw new Error(`${scenarioId} integration: ${message}`);
}
