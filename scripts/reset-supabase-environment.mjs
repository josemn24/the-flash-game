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

function redactStorageErrorMessage(value) {
  return String(value ?? "Error de Storage sin mensaje")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]+/gi, "[redacted key]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .replace(
      /\b([A-Z0-9_]*(?:API_KEY|SERVICE_ROLE_KEY|ANON_KEY|PUBLISHABLE_KEY|SECRET|PASSWORD|TOKEN|JWT)[A-Z0-9_]*)\s*[:=]\s*([^\s,"']+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b(authorization|api[_ -]?key|apikey|service[_ -]?role|password|secret|token)\b(\s*[:=]\s*|\s+)(?:["']?)([^\s,"']+)/gi,
      "$1$2[redacted]",
    );
}

function storageErrorDetails(error) {
  const details = {
    message: redactStorageErrorMessage(
      typeof error === "string" || typeof error === "number" ? error : error?.message,
    ),
  };
  const code = error?.code;
  const statusCode = error?.statusCode ?? error?.status;
  if (typeof code === "string" || typeof code === "number") details.code = code;
  if (typeof statusCode === "string" || typeof statusCode === "number")
    details.statusCode = statusCode;
  return details;
}

function storageCleanupError(operation, bucketId, error, message) {
  const details = storageErrorDetails(error);
  const location = bucketId ? ` en ${bucketId}` : "";
  const wrapped = new Error(`${message}${location}. Detalle: ${details.message}`);
  wrapped.name = "StorageCleanupError";
  wrapped.storageFailure = { operation, ...(bucketId ? { bucketId } : {}), ...details };
  return wrapped;
}

export async function waitForStorageBucketEmpty(
  sql,
  bucketId,
  {
    onProgress = async () => {},
    timeoutMs = 120_000,
    pollIntervalMs = 1_000,
    delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = () => Date.now(),
  } = {},
) {
  await onProgress({ event: "operation_started", operation: "waitForEmpty", bucketId });
  const deadline = now() + timeoutMs;
  const bucketLiteral = `'${bucketId.replaceAll("'", "''")}'`;
  for (;;) {
    const result = await sql(
      `select exists(select 1 from storage.objects where bucket_id = ${bucketLiteral});`,
    );
    const exists = String(result).trim().toLowerCase();
    if (exists !== "true" && exists !== "false")
      throw new Error("No se pudo interpretar la comprobación de objetos de Storage.");
    const objectsRemain = exists === "true";
    await onProgress({
      event: "object_check",
      operation: "waitForEmpty",
      bucketId,
      objectsRemain,
    });
    if (!objectsRemain) {
      await onProgress({
        event: "operation_completed",
        operation: "waitForEmpty",
        bucketId,
      });
      return;
    }
    const remainingMs = deadline - now();
    if (remainingMs <= 0)
      throw storageCleanupError(
        "waitForEmpty",
        bucketId,
        {
          code: "Timeout",
          message: `Storage sigue mostrando objetos tras ${Math.ceil(timeoutMs / 1_000)} segundos`,
        },
        "No se confirmó que el bucket quedara vacío",
      );
    await delay(Math.min(pollIntervalMs, remainingMs));
  }
}

export async function clearStorage(
  client,
  { onProgress = async () => {}, waitForBucketEmpty } = {},
) {
  if (typeof waitForBucketEmpty !== "function")
    throw new Error("La limpieza de Storage requiere verificar que el vaciado haya terminado.");
  await onProgress({ event: "operation_started", operation: "listBuckets" });
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error)
    throw storageCleanupError("listBuckets", null, error, "No se pudieron consultar los buckets");
  await onProgress({
    event: "operation_completed",
    operation: "listBuckets",
    bucketCount: buckets.length,
  });
  for (const bucket of buckets) {
    await onProgress({ event: "operation_started", operation: "emptyBucket", bucketId: bucket.id });
    const emptied = await client.storage.emptyBucket(bucket.id);
    if (emptied.error)
      throw storageCleanupError(
        "emptyBucket",
        bucket.id,
        emptied.error,
        "No se pudo vaciar el bucket",
      );
    await onProgress({
      event: "operation_completed",
      operation: "emptyBucket",
      bucketId: bucket.id,
    });
    await waitForBucketEmpty(bucket.id);

    await onProgress({
      event: "operation_started",
      operation: "deleteBucket",
      bucketId: bucket.id,
    });
    const deleted = await client.storage.deleteBucket(bucket.id);
    if (deleted.error)
      throw storageCleanupError(
        "deleteBucket",
        bucket.id,
        deleted.error,
        "No se pudo eliminar el bucket",
      );
    await onProgress({
      event: "operation_completed",
      operation: "deleteBucket",
      bucketId: bucket.id,
    });
  }
  await onProgress({ event: "operation_started", operation: "verifyBuckets" });
  const verified = await client.storage.listBuckets();
  if (verified.error)
    throw storageCleanupError(
      "verifyBuckets",
      null,
      verified.error,
      "No se pudo comprobar que Storage haya quedado vacío",
    );
  if (verified.data.length)
    throw storageCleanupError(
      "verifyBuckets",
      null,
      { message: `Quedan buckets: ${verified.data.map(({ id }) => id).join(", ")}` },
      "Storage no ha quedado vacío",
    );
  await onProgress({ event: "operation_completed", operation: "verifyBuckets" });
  return buckets.length;
}

function storageProgressLog(event) {
  const bucket = event.bucketId ? ` ${event.bucketId}` : "";
  if (event.event === "operation_started") {
    const action = {
      connectForEmptyCheck: "conectando para verificar el vaciado de Storage",
      listBuckets: "consultando buckets",
      emptyBucket: "vaciando bucket",
      waitForEmpty: "esperando a que termine el vaciado de",
      deleteBucket: "eliminando bucket",
      verifyBuckets: "comprobando que no queden buckets",
    }[event.operation];
    return `Storage: ${action}${bucket}.`;
  }
  if (event.operation === "listBuckets")
    return `Storage: encontrados ${event.bucketCount} bucket(s).`;
  if (event.operation === "emptyBucket") return `Storage: vaciado solicitado para bucket${bucket}.`;
  if (event.operation === "waitForEmpty" && event.event === "operation_completed")
    return `Storage: bucket${bucket} confirmado vacío.`;
  if (event.operation === "deleteBucket") return `Storage: bucket${bucket} eliminado.`;
  if (event.operation === "verifyBuckets") return "Storage: limpieza completada.";
  return null;
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
  for (const file of [
    "bootstrap-credentials.json",
    "bootstrap-manifest.json",
    "tabarnia-bootstrap-manifest.json",
  ])
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
      "Retirar credenciales compartidas y manifiestos de escenario anteriores",
    ],
  };
  await (dependencies.assertPreconditions ?? assertResetPreconditions)(config, env);
  if (options.dryRun) return { dryRun: true, ...plan };
  const save = dependencies.writeJsonSecure ?? writeJsonSecure;
  const journalPath = path.join(config.artifactDirectory, "reset-manifest.json");
  const journal = {
    ...plan,
    startedAt: new Date().toISOString(),
    completedSteps: [],
    status: "running",
    storage: {
      status: "pending",
      bucketProgress: [],
    },
  };
  const record = async (step) => {
    journal.completedSteps.push(step);
    await save(journalPath, journal);
  };
  await save(journalPath, journal);
  try {
    const client = (dependencies.environmentClient ?? environmentClient)(config);
    const log = dependencies.log ?? ((message) => console.error(message));
    const updateStorageProgress = async (event) => {
      const storage = journal.storage;
      storage.status = "running";
      storage.currentOperation = event.operation;
      if (event.bucketId) {
        storage.currentBucket = event.bucketId;
        if (!storage.bucketProgress.some(({ id }) => id === event.bucketId))
          storage.bucketProgress.push({
            id: event.bucketId,
            emptyRequested: false,
            emptyVerified: false,
            objectsRemain: null,
            deleted: false,
          });
      } else {
        delete storage.currentBucket;
      }
      if (event.event === "object_check") {
        const bucket = storage.bucketProgress.find(({ id }) => id === event.bucketId);
        if (bucket) {
          bucket.objectsRemain = event.objectsRemain;
          bucket.emptyVerified = !event.objectsRemain;
        }
      }
      if (event.event === "operation_completed") {
        storage.lastCompletedOperation = event.operation;
        if (event.operation === "listBuckets") storage.bucketCount = event.bucketCount;
        if (event.operation === "emptyBucket") {
          const bucket = storage.bucketProgress.find(({ id }) => id === event.bucketId);
          if (bucket) bucket.emptyRequested = true;
        }
        if (event.operation === "deleteBucket") {
          const bucket = storage.bucketProgress.find(({ id }) => id === event.bucketId);
          if (bucket) bucket.deleted = true;
        }
        if (event.operation === "verifyBuckets") {
          storage.status = "complete";
          storage.completedAt = new Date().toISOString();
          delete storage.currentOperation;
          delete storage.currentBucket;
        }
      }
      await save(journalPath, journal);
      const message = storageProgressLog(event);
      if (message) log(message);
    };
    const withSql = dependencies.withSql ?? withEnvironmentSql;
    const waitForEmpty = dependencies.waitForStorageBucketEmpty ?? waitForStorageBucketEmpty;
    await updateStorageProgress({
      event: "operation_started",
      operation: "connectForEmptyCheck",
    });
    journal.deletedBuckets = await withSql(config, (sql) =>
      clearStorage(client, {
        onProgress: updateStorageProgress,
        waitForBucketEmpty: (bucketId) =>
          waitForEmpty(sql, bucketId, {
            ...(dependencies.storageWaitOptions ?? {}),
            onProgress: updateStorageProgress,
          }),
      }),
    );
    await record("storage");
    journal.deletedUsers = await clearAuth(client);
    await record("auth");
    await (dependencies.resetDatabase ?? resetEnvironmentDatabase)(config, env);
    await record("postgres");
    const verification = await withSql(config, (sql) => verifyCleanDatabase(sql, config.buckets));
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
  } catch (error) {
    journal.status = "failed";
    journal.failedStep = ["storage", "auth", "postgres", "verification", "artifacts"][
      journal.completedSteps.length
    ];
    let storageFailure;
    if (journal.failedStep === "storage") {
      storageFailure = error?.storageFailure ?? {
        operation: journal.storage.currentOperation ?? "unknown",
        ...(journal.storage.currentBucket ? { bucketId: journal.storage.currentBucket } : {}),
        ...storageErrorDetails(error),
      };
      journal.storage = {
        ...journal.storage,
        status: "failed",
        failedAt: new Date().toISOString(),
        error: storageFailure,
      };
    }
    await save(journalPath, journal);
    const storageDetail = storageFailure
      ? ` (${storageFailure.operation}${storageFailure.bucketId ? `, bucket ${storageFailure.bucketId}` : ""}${storageFailure.code ? `, code ${storageFailure.code}` : ""}${storageFailure.statusCode ? `, HTTP ${storageFailure.statusCode}` : ""}: ${storageFailure.message})`
      : "";
    throw new Error(
      `Reinicio interrumpido en ${journal.failedStep}${storageDetail}. Consulta ${journalPath}; el bootstrap no se ha ejecutado.`,
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
