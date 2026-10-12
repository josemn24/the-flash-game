import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkInventory } from "./supabase-security-inventory.mjs";
import {
  assertEnvironmentRevision,
  assertEnvironmentTarget,
  environmentClient,
  loadOperationalEnv,
  parseEnvironmentArgs,
  resetEnvironmentDatabase,
  resolveEnvironment,
  withEnvironmentSql,
} from "./support/supabase-environment.mjs";
import {
  APPLICATION_BUCKETS,
  bucketMatches,
  writeJsonSecure,
} from "./support/supabase-provisioning.mjs";

export async function clearStorage(client) {
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error)
    throw new Error("No se pudieron consultar los buckets; no se ha reiniciado PostgreSQL.");
  for (const bucket of buckets) {
    const emptied = await client.storage.emptyBucket(bucket.id);
    if (emptied.error)
      throw new Error(`No se pudo vaciar ${bucket.id}; se interrumpe el reinicio.`);
    const deleted = await client.storage.deleteBucket(bucket.id);
    if (deleted.error)
      throw new Error(`No se pudo eliminar ${bucket.id}; se interrumpe el reinicio.`);
  }
  const verified = await client.storage.listBuckets();
  if (verified.error || verified.data.length) throw new Error("Storage no ha quedado vacío.");
  return buckets.length;
}

export async function clearAuth(client) {
  let deleted = 0;
  const seen = new Set();
  for (;;) {
    // Restart pagination after deletions: increasing page skips remaining users.
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error("No se pudieron consultar las cuentas de Auth.");
    if (!data.users.length) return deleted;
    for (const user of data.users) {
      if (seen.has(user.id))
        throw new Error("Auth sigue devolviendo una cuenta eliminada; se interrumpe el reinicio.");
      const result = await client.auth.admin.deleteUser(user.id, false);
      if (result.error)
        throw new Error("No se pudo eliminar una cuenta de Auth; se interrumpe el reinicio.");
      seen.add(user.id);
      deleted++;
    }
  }
}

export async function assertResetPreconditions(
  config,
  env,
  readLinkedRef = () => readFile("supabase/.temp/project-ref", "utf8"),
) {
  assertEnvironmentTarget(config.target);
  if (config.target === "local") return;
  if (env.SUPABASE_RESET_CONFIRM !== `${config.target}:${config.projectRef}`)
    throw new Error("SUPABASE_RESET_CONFIRM debe identificar exactamente el entorno y proyecto.");
  if (env.FLASH_WRITES_PAUSED !== "true")
    throw new Error("Detén el acceso y el calendario y establece FLASH_WRITES_PAUSED=true.");
  const linkedRef = (await readLinkedRef()).trim();
  if (linkedRef !== config.projectRef)
    throw new Error("El proyecto enlazado en la CLI no coincide; no se borrará Storage ni Auth.");
}

export async function clearEnvironmentArtifacts(config) {
  assertEnvironmentTarget(config.target);
  for (const file of ["bootstrap-credentials.json", "bootstrap-manifest.json"])
    await rm(path.join(config.artifactDirectory, file), { force: true });
  if (config.target === "local") {
    const entries = await readdir("output/fixtures", { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries)
      if (entry.isFile() && entry.name.endsWith(".json"))
        await rm(path.join("output/fixtures", entry.name));
  }
}

export async function verifyCleanDatabase(sql, buckets = APPLICATION_BUCKETS) {
  const counts = JSON.parse(
    await sql(`select jsonb_build_object(
    'authUsers', (select count(*) from auth.users),
    'players', (select count(*) from public.players),
    'rooms', (select count(*) from public.rooms),
    'questions', (select count(*) from private.question_versions),
    'attempts', (select count(*) from public.attempts),
    'points', (select count(*) from private.flash_point_entries),
    'buckets', (select count(*) from storage.buckets),
    'objects', (select count(*) from storage.objects));`),
  );
  if (Object.entries(counts).some(([key, value]) => key !== "buckets" && value !== 0))
    throw new Error("El entorno conserva datos después del reinicio.");
  // The local CLI recreates configured empty buckets after resetting PostgreSQL.
  const actualBuckets = JSON.parse(
    await sql(
      "select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)), '[]'::jsonb) from storage.buckets;",
    ),
  );
  if (
    actualBuckets.length &&
    (actualBuckets.length !== buckets.length ||
      actualBuckets.some((actual) => {
        const expected = buckets.find((bucket) => bucket.id === actual.id);
        return !expected || !bucketMatches(actual, expected);
      }))
  )
    throw new Error("El reset ha dejado buckets inesperados o incompatibles.");
  await checkInventory(sql, { mutationTests: false });
  return { revision: await assertEnvironmentRevision(sql), counts };
}

export async function runEnvironmentReset({
  env = process.env,
  args = [],
  dependencies = {},
} = {}) {
  const options = parseEnvironmentArgs(args);
  const config = await (dependencies.resolveEnvironment ?? resolveEnvironment)(options.target, env);
  assertEnvironmentTarget(config.target);
  const plan = {
    target: config.target,
    projectRef: config.projectRef,
    url: config.supabaseUrl,
    steps: [
      "Comprobar destino y pausa de escrituras",
      "Vaciar y eliminar Storage por API",
      "Eliminar cuentas de Auth",
      "Reconstruir PostgreSQL con todas las migraciones, sin seed",
      "Comprobar revisión, permisos y ausencia de datos",
      "Retirar credenciales y manifiestos anteriores",
    ],
  };
  if (options.dryRun) return { dryRun: true, ...plan };
  await (dependencies.assertPreconditions ?? assertResetPreconditions)(config, env);
  const save = dependencies.writeJsonSecure ?? writeJsonSecure;
  const journalPath = path.join(config.artifactDirectory, "reset-manifest.json");
  const journal = {
    ...plan,
    startedAt: new Date().toISOString(),
    completedSteps: [],
    status: "running",
  };
  const record = async (step) => {
    journal.completedSteps.push(step);
    await save(journalPath, journal);
  };
  await save(journalPath, journal);
  try {
    const client = (dependencies.environmentClient ?? environmentClient)(config);
    journal.deletedBuckets = await clearStorage(client);
    await record("storage");
    journal.deletedUsers = await clearAuth(client);
    await record("auth");
    await (dependencies.resetDatabase ?? resetEnvironmentDatabase)(config, env);
    await record("postgres");
    const verification = await (dependencies.withSql ?? withEnvironmentSql)(config, (sql) =>
      verifyCleanDatabase(sql, config.buckets),
    );
    Object.assign(journal, verification);
    await record("verification");
    await (dependencies.clearArtifacts ?? clearEnvironmentArtifacts)(config);
    await record("artifacts");
    journal.status = "complete";
    journal.completedAt = new Date().toISOString();
    await save(journalPath, journal);
    return {
      dryRun: false,
      target: config.target,
      projectRef: config.projectRef,
      revision: journal.revision,
      manifestPath: journalPath,
    };
  } catch {
    journal.status = "failed";
    journal.failedStep = ["storage", "auth", "postgres", "verification", "artifacts"][
      journal.completedSteps.length
    ];
    await save(journalPath, journal);
    throw new Error(
      `Reinicio interrumpido en ${journal.failedStep}. Consulta ${journalPath}; el bootstrap no se ha ejecutado.`,
    );
  }
}

async function main() {
  const options = parseEnvironmentArgs(process.argv.slice(2));
  loadOperationalEnv(options);
  console.log(JSON.stringify(await runEnvironmentReset({ args: process.argv.slice(2) }), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
