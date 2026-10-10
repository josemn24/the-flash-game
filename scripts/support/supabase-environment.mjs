import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { dockerSql, localSupabaseConfig } from "./supabase-local.mjs";
import { APPLICATION_BUCKETS, comparableSize } from "./supabase-provisioning.mjs";

const execFileAsync = promisify(execFile);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const environmentTargets = Object.freeze(["local", "staging"]);

export function assertEnvironmentTarget(target, targets = environmentTargets) {
  const allowedTargets = targets.filter((candidate) => environmentTargets.includes(candidate));
  if (!allowedTargets.includes(target))
    throw new Error(
      `Indica --target ${(allowedTargets.length ? allowedTargets : environmentTargets).join("|")}.`,
    );
}

export function localBucketDefinitions(toml) {
  return APPLICATION_BUCKETS.map((fallback) => {
    const section = toml.match(
      new RegExp(
        `^\\[storage\\.buckets\\.${fallback.id}\\]([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`,
        "m",
      ),
    )?.[1];
    if (!section) return fallback;
    const limit = section.match(/^file_size_limit\s*=\s*"([^"]+)"/m)?.[1];
    const mimeTypes = section.match(/^allowed_mime_types\s*=\s*(\[[\s\S]*?\])/m)?.[1];
    const isPublic = section.match(/^public\s*=\s*(true|false)/m)?.[1];
    // The local CLI interprets KB/MB/GB as binary units; the Storage API uses
    // decimal units. Preserve each environment's existing configuration.
    const fileSizeLimit = comparableSize(limit?.replace(/(K|M|G)B$/i, "$1iB"));
    if (fileSizeLimit === null || !mimeTypes || !isPublic)
      throw new Error("La configuración local de buckets es incompleta.");
    return {
      id: fallback.id,
      public: isPublic === "true",
      fileSizeLimit,
      allowedMimeTypes: JSON.parse(mimeTypes),
    };
  });
}

export function parseEnvironmentArgs(args, { targets = environmentTargets } = {}) {
  const options = { target: null, dryRun: false, envFile: null };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (["--target", "--env-file"].includes(argument)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Falta el valor de ${argument}.`);
      const key = argument === "--target" ? "target" : "envFile";
      if (options[key]) throw new Error(`${argument} no puede repetirse.`);
      options[key] = value;
    } else throw new Error(`Argumento desconocido: ${argument}.`);
  }
  assertEnvironmentTarget(options.target, targets);
  return options;
}

export function loadOperationalEnv(options) {
  assertEnvironmentTarget(options.target);
  const file = options.envFile ?? (options.target === "local" ? ".env.local" : null);
  if (!file) return;
  try {
    process.loadEnvFile(file);
  } catch (error) {
    if (options.envFile || error.code !== "ENOENT")
      throw new Error("No se pudo cargar el archivo de entorno.");
  }
}

function required(env, name) {
  if (!env[name]?.trim()) throw new Error(`${name} es obligatorio.`);
  return env[name].trim();
}

export function validateRemoteEnvironment(target, env) {
  assertEnvironmentTarget(target, ["staging"]);
  const projectRef = required(env, "STAGING_PROJECT_REF");
  if (!/^[a-z0-9-]+$/.test(projectRef)) throw new Error("Referencia de proyecto inválida.");
  let apiUrl, dbUrl;
  try {
    apiUrl = new URL(required(env, "NEXT_PUBLIC_SUPABASE_URL"));
    dbUrl = new URL(required(env, "SUPABASE_ADMIN_DB_URL"));
  } catch {
    throw new Error("Las URLs del destino son inválidas o están ausentes.");
  }
  if (
    apiUrl.origin !== `https://${projectRef}.supabase.co` ||
    apiUrl.pathname !== "/" ||
    apiUrl.search ||
    apiUrl.hash ||
    apiUrl.username ||
    apiUrl.password
  )
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no coincide con el proyecto indicado.");
  const username = decodeURIComponent(dbUrl.username);
  const direct = dbUrl.hostname === `db.${projectRef}.supabase.co` && username === "postgres";
  const pooled =
    /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(dbUrl.hostname) &&
    username === `postgres.${projectRef}` &&
    dbUrl.port === "5432";
  if (
    !["postgres:", "postgresql:"].includes(dbUrl.protocol) ||
    (!direct && !pooled) ||
    dbUrl.pathname !== "/postgres" ||
    !dbUrl.password
  )
    throw new Error(
      "SUPABASE_ADMIN_DB_URL debe identificar el mismo proyecto con una conexión administrativa directa o Session pooler.",
    );
  return {
    target,
    projectRef,
    supabaseUrl: apiUrl.origin,
    adminDbUrl: dbUrl.toString(),
    publishableKey: required(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: required(env, "SUPABASE_SERVICE_ROLE_KEY"),
    artifactDirectory: path.join("output", target),
  };
}

export async function resolveEnvironment(target, env = process.env) {
  assertEnvironmentTarget(target);
  if (target !== "local") return validateRemoteEnvironment(target, env);
  const workdir = env.SUPABASE_TEST_WORKDIR ?? process.cwd();
  const toml = await readFile(path.join(workdir, "supabase", "config.toml"), "utf8");
  const projectRef = toml.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  const apiPort = toml.match(/\[api\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1];
  if (!projectRef || !apiPort) throw new Error("No se pudo identificar el stack local.");
  const supplied =
    env.NEXT_PUBLIC_SUPABASE_URL &&
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    env.SUPABASE_SERVICE_ROLE_KEY;
  const credentials = supplied
    ? {
        url: env.NEXT_PUBLIC_SUPABASE_URL,
        publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      }
    : await localSupabaseConfig({ requireServiceRole: true });
  const apiUrl = new URL(credentials.url);
  const dbContainer = env.SUPABASE_DB_CONTAINER ?? `supabase_db_${projectRef}`;
  if (
    !localHosts.has(apiUrl.hostname) ||
    apiUrl.port !== apiPort ||
    apiUrl.pathname !== "/" ||
    apiUrl.username ||
    apiUrl.password ||
    dbContainer !== `supabase_db_${projectRef}`
  )
    throw new Error("La URL, el puerto y el contenedor deben pertenecer al mismo stack local.");
  return {
    target,
    projectRef,
    supabaseUrl: apiUrl.origin,
    publishableKey: credentials.publishableKey,
    serviceRoleKey: credentials.serviceRoleKey,
    dbContainer,
    workdir,
    artifactDirectory: path.join("output", "local"),
    buckets: localBucketDefinitions(toml),
  };
}

export function environmentClient(config, { user = false } = {}) {
  assertEnvironmentTarget(config.target);
  return createClient(config.supabaseUrl, user ? config.publishableKey : config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function withEnvironmentSql(config, callback) {
  assertEnvironmentTarget(config.target);
  if (config.target === "local")
    return callback(async (statement) =>
      (await dockerSql(statement, config.dbContainer)).stdout.trim(),
    );
  const client = new Client({
    connectionString: config.adminDbUrl,
    application_name: "flash-environment-provisioning",
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query("set statement_timeout = '30000ms'");
    return await callback(async (statement) => {
      const result = await client.query(statement);
      const final = Array.isArray(result) ? result.at(-1) : result;
      const value = Object.values(final.rows[0] ?? {})[0];
      return value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    });
  } finally {
    await client.end();
  }
}

export async function assertEnvironmentRevision(sql) {
  const files = (await readdir("supabase/migrations"))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  const expectedVersions = files.map((name) => name.split("_")[0]);
  const actualVersions = JSON.parse(
    await sql(
      "select coalesce(jsonb_agg(version order by version), '[]'::jsonb) from supabase_migrations.schema_migrations;",
    ),
  );
  if (JSON.stringify(actualVersions) !== JSON.stringify(expectedVersions))
    throw new Error("El historial aplicado no coincide con las migraciones del repositorio.");
  return files.at(-1).replace(/\.sql$/, "");
}

export async function resetEnvironmentDatabase(config, env = process.env) {
  assertEnvironmentTarget(config.target);
  const args = ["supabase", "db", "reset", "--no-seed", "--yes"];
  if (config.target === "local") args.push("--local", "--workdir", config.workdir);
  else {
    const linkedRef = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
    if (linkedRef !== config.projectRef)
      throw new Error("El proyecto enlazado en la CLI no coincide con el destino.");
    args.push("--linked", "--project-ref", config.projectRef);
  }
  try {
    await execFileAsync("npx", args, {
      env: {
        ...env,
        SUPABASE_TELEMETRY: "false",
        ...(config.adminDbUrl
          ? { SUPABASE_DB_PASSWORD: decodeURIComponent(new URL(config.adminDbUrl).password) }
          : {}),
      },
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    throw new Error(
      "Falló el reset de PostgreSQL. Mantén el entorno cerrado y comprueba la CLI antes de continuar.",
    );
  }
}
