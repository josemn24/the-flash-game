import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { validateRemoteEnvironment } from "./support/supabase-environment.mjs";
import { normalizeStartAt, validateFutureStartAt } from "./schedule-profile.mjs";
import {
  buildStagingBetaVipDomainSql,
  prepareCassetteAsset,
  stagingBetaVipExpectedContent,
  stagingBetaVipManifest,
} from "./seed-betavip.mjs";
import {
  APPLICATION_BUCKETS as STAGING_BUCKETS,
  bucketMatches,
  ensureBuckets,
  generatePassword,
  readJsonIfPresent,
  writeJsonSecure,
} from "./support/supabase-provisioning.mjs";
export { STAGING_BUCKETS, bucketMatches, generatePassword, writeJsonSecure };

const CONFIRMATION_VALUE = "the-flash-game-staging";
const DEFAULT_CREDENTIALS_PATH = path.join("output", "staging", "bootstrap-credentials.json");
const DEFAULT_MANIFEST_PATH = path.join("output", "staging", "bootstrap-manifest.json");
const ACCOUNT_DEFINITIONS = [
  { key: "xesmona", displayName: "Xesmona" },
  { key: "ches", displayName: "Ches" },
];

export function parseArgs(args) {
  const options = { dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--starts-at") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(
          "Falta la fecha de --starts-at. Usa ISO 8601 con zona horaria, por ejemplo 2026-10-20T19:00:00+02:00.",
        );
      }
      options.startsAt = normalizeStartAt(value);
      index += 1;
      continue;
    }
    throw new Error(
      `Argumento desconocido: ${argument}. Usa --dry-run, --starts-at <ISO-8601-con-zona-horaria> o sin argumentos.`,
    );
  }
  return options;
}

export function validateBootstrapConfig(env = process.env) {
  const { projectRef, supabaseUrl, publishableKey, serviceRoleKey, adminDbUrl } =
    validateRemoteEnvironment("staging", env);
  const required = ["STAGING_XESMONA_EMAIL", "STAGING_CHES_EMAIL", "STAGING_BOOTSTRAP_CONFIRM"];
  for (const name of required) {
    if (!env[name]?.trim()) throw new Error(`${name} es obligatorio.`);
  }
  if (env.STAGING_BOOTSTRAP_CONFIRM !== CONFIRMATION_VALUE) {
    throw new Error(`STAGING_BOOTSTRAP_CONFIRM debe ser ${CONFIRMATION_VALUE}.`);
  }

  const emails = {
    xesmona: env.STAGING_XESMONA_EMAIL.trim().toLowerCase(),
    ches: env.STAGING_CHES_EMAIL.trim().toLowerCase(),
  };
  if (emails.xesmona === emails.ches) {
    throw new Error("Xesmona y Ches deben utilizar emails diferentes.");
  }

  return {
    projectRef,
    supabaseUrl,
    publishableKey,
    serviceRoleKey,
    adminDbUrl,
    emails,
  };
}

export function buildAuthUserPayload({ definition, email, password, projectRef }) {
  return {
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: definition.displayName },
    app_metadata: {
      staging_bootstrap: { project_ref: projectRef, version: 1 },
    },
  };
}

function adminClient(config) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function userClient(config) {
  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function findAuthUserByEmail(client, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`No se pudieron consultar los usuarios de Auth: ${error.message}`);
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

function isBootstrapUser(user, projectRef) {
  return (
    user?.app_metadata?.staging_bootstrap?.project_ref === projectRef &&
    user?.app_metadata?.staging_bootstrap?.version === 1
  );
}

async function provisionPlayer(config, account) {
  const client = userClient(config);
  const { error: signInError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (signInError) {
    throw new Error(`No se pudo validar la contraseña existente de ${account.key}.`);
  }
  const { data, error } = await client.rpc("provision_player");
  if (error)
    throw new Error(`No se pudo aprovisionar el Player de ${account.key}: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.player_id)
    throw new Error(`provision_player no devolvió player_id para ${account.key}.`);
  return { ...account, playerId: row.player_id };
}

async function ensureAccount(config, definition, credentials, { onCreated } = {}) {
  const email = config.emails[definition.key];
  const client = adminClient(config);
  const existing = await findAuthUserByEmail(client, email);
  let password = credentials?.users?.[definition.key]?.password;
  let authUserId = existing?.id;

  if (existing) {
    if (!isBootstrapUser(existing, config.projectRef) || !password) {
      throw new Error(
        `La cuenta ${email} ya existe y no fue creada por este bootstrap o no tiene credencial local.`,
      );
    }
  } else {
    password ??= generatePassword();
    const { data, error } = await client.auth.admin.createUser(
      buildAuthUserPayload({ definition, email, password, projectRef: config.projectRef }),
    );
    if (error || !data.user) {
      throw new Error(
        `No se pudo crear la cuenta ${email}: ${error?.message ?? "respuesta inválida"}`,
      );
    }
    authUserId = data.user.id;
    await onCreated?.({
      key: definition.key,
      displayName: definition.displayName,
      email,
      password,
      authUserId,
    });
  }

  return provisionPlayer(config, {
    key: definition.key,
    displayName: definition.displayName,
    email,
    password,
    authUserId,
  }).then((account) => ({
    ...account,
    authUserId: account.authUserId ?? authUserId,
  }));
}

async function prepareAndUploadCassette(client) {
  const prepared = await prepareCassetteAsset();
  const objectPath = stagingBetaVipManifest().questionAssets[0].objectPath;
  let uploaded = false;
  try {
    const bytes = await readFile(prepared.filePath);
    const { data: existing, error: downloadError } = await client.storage
      .from("question-assets")
      .download(objectPath);
    if (!downloadError && existing) {
      const existingHash = createHash("sha256")
        .update(Buffer.from(await existing.arrayBuffer()))
        .digest("hex");
      if (existingHash !== prepared.metadata.sha256) {
        throw new Error(`El asset ${objectPath} ya existe con un hash diferente.`);
      }
    } else if (
      downloadError &&
      !String(downloadError.statusCode).includes("404") &&
      !/not found/i.test(downloadError.message ?? "")
    ) {
      throw new Error(`No se pudo comprobar el asset ${objectPath}: ${downloadError.message}`);
    } else {
      const { error: uploadError } = await client.storage
        .from("question-assets")
        .upload(objectPath, bytes, {
          contentType: "image/png",
          upsert: false,
        });
      if (uploadError)
        throw new Error(`No se pudo subir el asset ${objectPath}: ${uploadError.message}`);
      uploaded = true;
    }
    return { metadata: prepared.metadata, uploaded };
  } finally {
    await prepared.cleanup();
  }
}

function expectedQuestionRows() {
  const content = stagingBetaVipExpectedContent();
  return [
    ...content.alphabet,
    ...content.survival,
    ...content.pyramid,
    ...content.antiquity,
    ...content.timeTrial,
  ];
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJson(item)]),
    );
  }
  return value;
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(stableJson(actual)) !== JSON.stringify(stableJson(expected)))
    throw new Error(message);
}

async function validateDomain(client, accounts, assetMetadata) {
  const data = stagingBetaVipManifest();
  const room = (
    await client.query("select id::text, slug, title from public.rooms where id = $1", [
      data.room.id,
    ])
  ).rows[0];
  if (!room || room.slug !== "beta-vip" || room.title !== "BetaVIP")
    throw new Error("La sala BetaVIP no coincide con lo esperado.");
  const season = (
    await client.query(
      "select room_id::text, status, extract(epoch from ends_at - starts_at)::integer as duration_seconds from public.seasons where id = $1",
      [data.seasonId],
    )
  ).rows[0];
  if (
    !season ||
    season.room_id !== data.room.id ||
    season.status !== "active" ||
    season.duration_seconds !== 120 * 60 * 60
  ) {
    throw new Error("La temporada BetaVIP no coincide con lo esperado.");
  }
  const role = (
    await client.query("select role from private.platform_role_assignments where player_id = $1", [
      accounts.xesmona.playerId,
    ])
  ).rows[0];
  if (role?.role !== "superadmin") throw new Error("Xesmona no tiene el rol superadmin esperado.");
  const membership = (
    await client.query(
      "select role, status from public.room_memberships where room_id = $1 and player_id = $2",
      [data.room.id, accounts.ches.playerId],
    )
  ).rows[0];
  if (membership?.role !== "owner" || membership.status !== "active")
    throw new Error("Ches no tiene la membresía owner esperada.");
  const asset = (
    await client.query(
      "select bucket_id, object_path, status, byte_size, width, height, sha256 from private.media_assets where id = $1",
      [data.questionAssets[0].id],
    )
  ).rows[0];
  if (
    !asset ||
    asset.bucket_id !== "question-assets" ||
    asset.object_path !== data.questionAssets[0].objectPath ||
    asset.status !== "ready" ||
    Number(asset.byte_size) !== assetMetadata.byteSize ||
    asset.width !== 1200 ||
    asset.height !== 800 ||
    asset.sha256 !== assetMetadata.sha256
  ) {
    throw new Error("El registro del asset BetaVIP no coincide con lo esperado.");
  }

  const questions = expectedQuestionRows();
  const questionRows = (
    await client.query(
      `select definition.id::text as definition_id, definition.slug, version.id::text as version_id,
            version.type, version.status, version.time_limit_ms, version.public_payload,
            solution.solution_payload
       from private.question_definitions definition
       join private.question_versions version on version.question_definition_id = definition.id
       join private.question_version_solutions solution on solution.question_version_id = version.id
      where version.id = any($1::uuid[])`,
      [questions.map((item) => item.versionId)],
    )
  ).rows;
  if (questionRows.length !== questions.length) throw new Error("Faltan preguntas BetaVIP.");
  const expectedByVersion = new Map(questions.map((item) => [item.versionId, item]));
  for (const row of questionRows) {
    const expected = expectedByVersion.get(row.version_id);
    if (!expected) throw new Error("Hay una pregunta BetaVIP inesperada.");
    assertEqual(row.slug, expected.slug, `Slug incompatible para ${row.version_id}.`);
    assertEqual(row.type, expected.type, `Formato incompatible para ${row.slug}.`);
    assertEqual(row.status, "published", `La pregunta ${row.slug} no está publicada.`);
    assertEqual(row.time_limit_ms, expected.timeLimitMs, `Tiempo incompatible para ${row.slug}.`);
    assertEqual(
      row.public_payload,
      expected.publicPayload,
      `Payload público incompatible para ${row.slug}.`,
    );
    assertEqual(
      row.solution_payload,
      expected.solutionPayload,
      `Solución incompatible para ${row.slug}.`,
    );
  }

  const publications = data.publications;
  const challengeRows = (
    await client.query(
      `select version.id::text as version_id, version.title, version.mode, version.status,
            version.max_score, version.global_time_limit_ms,
            count(item.id)::integer as item_count,
            coalesce(sum(item.points), 0)::integer as points_total
       from private.challenge_versions version
       left join private.challenge_items item on item.challenge_version_id = version.id
      where version.id = any($1::uuid[])
      group by version.id, version.title, version.mode, version.status`,
      [publications.map((item) => item.challengeVersionId)],
    )
  ).rows;
  if (challengeRows.length !== publications.length) throw new Error("Faltan desafíos BetaVIP.");
  for (const publication of publications) {
    const row = challengeRows.find((item) => item.version_id === publication.challengeVersionId);
    if (
      !row ||
      row.title !== publication.title ||
      row.mode !== publication.mode ||
      row.status !== "published" ||
      row.item_count !== publication.questionCount ||
      row.points_total !== publication.pointsTotal ||
      (publication.mode === "time-trial" &&
        (row.max_score !== 100 || row.global_time_limit_ms !== 180000))
    ) {
      throw new Error(`El desafío ${publication.title} no coincide con lo esperado.`);
    }
  }

  const scheduleRows = (
    await client.query(
      `select scheduled.id::text, scheduled.status,
            extract(epoch from scheduled.opens_at - season.starts_at)::integer as opens_after,
            extract(epoch from scheduled.closes_at - scheduled.opens_at)::integer as duration
       from public.scheduled_challenges scheduled
       join public.seasons season on season.id = scheduled.season_id
      where scheduled.season_id = $1
      order by scheduled.number`,
      [data.seasonId],
    )
  ).rows;
  assertEqual(scheduleRows.length, 5, "La temporada BetaVIP debe tener cinco desafíos.");
  assertEqual(
    scheduleRows.map((row) => [row.status, row.opens_after, row.duration]),
    [
      ["open", 0, 24 * 60 * 60],
      ["scheduled", 24 * 60 * 60, 24 * 60 * 60],
      ["scheduled", 48 * 60 * 60, 24 * 60 * 60],
      ["scheduled", 72 * 60 * 60, 24 * 60 * 60],
      ["scheduled", 96 * 60 * 60, 24 * 60 * 60],
    ],
    "El calendario BetaVIP no coincide con lo esperado.",
  );
}

async function applyDomain(config, accounts, assetMetadata, startsAt = null) {
  const normalizedStartAt = normalizeStartAt(startsAt);
  const data = stagingBetaVipManifest(normalizedStartAt);
  const client = new Client({
    connectionString: config.adminDbUrl,
    application_name: "the-flash-game-staging-bootstrap",
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout = '30000ms'");
    if (normalizedStartAt) {
      const existingSeason = await client.query(
        "select starts_at = $2::timestamptz as matches from public.seasons where id = $1 for update",
        [data.seasonId, normalizedStartAt],
      );
      if (existingSeason.rows[0]) {
        if (existingSeason.rows[0].matches !== true) {
          throw new Error(
            "La temporada BetaVIP ya existe con otra fecha de inicio. El bootstrap conserva las temporadas existentes; para cambiar la fecha, prepara una base vacía siguiendo el procedimiento de reinstalación de staging.",
          );
        }
      } else {
        validateFutureStartAt(normalizedStartAt);
      }
    }
    await client.query(
      buildStagingBetaVipDomainSql({
        xesmonaPlayerId: accounts.xesmona.playerId,
        chesPlayerId: accounts.ches.playerId,
        cassetteAssetMetadata: assetMetadata,
        startsAt: normalizedStartAt,
      }),
    );
    if (normalizedStartAt) {
      const persistedSeason = await client.query(
        "select starts_at = $2::timestamptz as matches from public.seasons where id = $1",
        [data.seasonId, normalizedStartAt],
      );
      if (persistedSeason.rows[0]?.matches !== true) {
        throw new Error(
          "La temporada BetaVIP ya existe con otra fecha de inicio. El bootstrap conserva las temporadas existentes; para cambiar la fecha, prepara una base vacía siguiendo el procedimiento de reinstalación de staging.",
        );
      }
    }
    await validateDomain(client, accounts, assetMetadata);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function writeManifest(accounts, config, startsAt = null) {
  await writeJsonSecure(DEFAULT_MANIFEST_PATH, {
    version: 1,
    projectRef: config.projectRef,
    generatedAt: new Date().toISOString(),
    users: Object.fromEntries(
      Object.entries(accounts).map(([key, account]) => [
        key,
        {
          email: account.email,
          authUserId: account.authUserId,
          playerId: account.playerId,
          role: key === "xesmona" ? "superadmin" : "owner",
        },
      ]),
    ),
    data: stagingBetaVipManifest(startsAt),
  });
}

function credentialsDocument(accounts, config) {
  return {
    version: 1,
    projectRef: config.projectRef,
    generatedAt: new Date().toISOString(),
    users: Object.fromEntries(
      Object.entries(accounts).map(([key, account]) => [
        key,
        {
          email: account.email,
          password: account.password,
          authUserId: account.authUserId,
          playerId: account.playerId,
        },
      ]),
    ),
  };
}

export async function runBootstrap({ env = process.env, args = [], dependencies = {} } = {}) {
  const options = parseArgs(args);
  const config = validateBootstrapConfig(env);
  if (options.dryRun) {
    const result = {
      dryRun: true,
      config: { projectRef: config.projectRef, emails: config.emails },
    };
    if (options.startsAt) result.seasonStartsAt = options.startsAt;
    return result;
  }

  const credentialsPath = dependencies.credentialsPath ?? DEFAULT_CREDENTIALS_PATH;
  const previousCredentials = await readJsonIfPresent(credentialsPath);
  const accounts = {};
  for (const definition of ACCOUNT_DEFINITIONS) {
    accounts[definition.key] = await ensureAccount(config, definition, previousCredentials, {
      onCreated: async (account) => {
        accounts[definition.key] = account;
        await writeJsonSecure(credentialsPath, credentialsDocument(accounts, config));
      },
    });
    await writeJsonSecure(credentialsPath, credentialsDocument(accounts, config));
  }

  const service = adminClient(config);
  await ensureBuckets(service);
  const asset = await prepareAndUploadCassette(service);
  try {
    await applyDomain(config, accounts, asset.metadata, options.startsAt);
    await writeManifest(accounts, config, options.startsAt);
  } catch (error) {
    if (asset.uploaded) {
      await service.storage
        .from("question-assets")
        .remove([stagingBetaVipManifest().questionAssets[0].objectPath]);
    }
    throw error;
  }

  return {
    dryRun: false,
    projectRef: config.projectRef,
    ...(options.startsAt ? { seasonStartsAt: options.startsAt } : {}),
    credentialsPath,
    manifestPath: DEFAULT_MANIFEST_PATH,
  };
}

async function main() {
  const result = await runBootstrap({ args: process.argv.slice(2) });
  if (result.dryRun) {
    console.log(`Dry-run correcto para ${result.config.projectRef}. No se ha escrito nada.`);
    if (result.seasonStartsAt) console.log(`Inicio de temporada: ${result.seasonStartsAt}.`);
    return;
  }
  console.log("Bootstrap de staging completado.");
  if (result.seasonStartsAt) console.log(`Inicio de temporada: ${result.seasonStartsAt}.`);
  console.log(`Credenciales: ${result.credentialsPath}`);
  console.log(`Manifiesto: ${result.manifestPath}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Falló el bootstrap de staging.");
    process.exitCode = 1;
  });
}
