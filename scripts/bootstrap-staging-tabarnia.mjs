import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTabarniaDomainSql,
  getAvatarMetadata,
  getSbrMapMetadata,
  prepareSpainAssets,
  TABARNIA_LEGACY_VERSION_IDS,
  TABARNIA_USERS,
  tabarniaChallengeCount,
  tabarniaManifest,
} from "./seed-tabarnia.mjs";
import { normalizeStartAt, validateFutureStartAt } from "./schedule-profile.mjs";
import {
  ensureStagingAccounts,
  ensureStagingFoundation,
  loadStagingBootstrapEnv,
  parseStagingBootstrapArgs,
  stagingAdminClient,
  STAGING_CREDENTIALS_PATH,
  validateStagingBootstrapConfig,
  withStagingDatabase,
} from "./support/staging-bootstrap.mjs";
import { writeJsonSecure } from "./support/supabase-provisioning.mjs";

const DEFAULT_MANIFEST_PATH = path.join("output", "staging", "tabarnia-bootstrap-manifest.json");
const SBR_MAP_PATH = path.resolve("public/visuals/sbr/usa-location-map.png");
const accountDefinitions = TABARNIA_USERS.map((user) => ({
  key: user.label,
  displayName: user.label === "xesmona" ? "Xesmona" : user.displayName,
  ...(user.label === "xesmona" || user.label === "ches"
    ? {}
    : { email: `tabarnia.${user.label}@example.test` }),
}));

export function parseArgs(args) {
  const options = parseStagingBootstrapArgs(args);
  if (options.startsAt) options.startsAt = normalizeStartAt(options.startsAt);
  return options;
}

export function tabarniaAccountDefinitions(config) {
  return accountDefinitions.map((definition) => ({
    ...definition,
    ...(definition.key === "xesmona" ? { email: config.emails.xesmona } : {}),
    ...(definition.key === "ches" ? { email: config.emails.ches } : {}),
  }));
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
  if (JSON.stringify(stableJson(actual)) !== JSON.stringify(stableJson(expected))) {
    throw new Error(message);
  }
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isMissingObject(error) {
  return (
    String(error?.statusCode ?? "").includes("404") ||
    /not found|object not found/i.test(error?.message ?? "")
  );
}

async function ensureStorageObject(client, object, uploadedObjects) {
  const bucket = client.storage.from(object.bucket);
  const { data: existing, error: downloadError } = await bucket.download(object.objectPath);
  if (!downloadError && existing) {
    const existingBytes = Buffer.from(await existing.arrayBuffer());
    if (hash(existingBytes) !== object.metadata.sha256) {
      throw new Error(`El asset ${object.objectPath} ya existe con un hash diferente.`);
    }
    return;
  }
  if (!isMissingObject(downloadError)) {
    throw new Error(
      `No se pudo comprobar el asset ${object.objectPath}: ${downloadError?.message}`,
    );
  }
  const bytes = await readFile(object.filePath);
  if (hash(bytes) !== object.metadata.sha256) {
    throw new Error(
      `El asset local ${object.objectPath} cambió mientras se preparaba el bootstrap.`,
    );
  }
  const { error } = await bucket.upload(object.objectPath, bytes, {
    contentType: object.metadata.mimeType,
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir el asset ${object.objectPath}: ${error.message}`);
  uploadedObjects.push(object);
}

async function removeUploadedObjects(client, objects) {
  await Promise.all(
    objects.map(async ({ bucket, objectPath }) => {
      await client.storage
        .from(bucket)
        .remove([objectPath])
        .catch(() => undefined);
    }),
  );
}

function expectedAssets(accounts, avatarMetadata, spainAssets, sbrAssetMetadata) {
  return [
    {
      id: tabarniaManifest(accounts, avatarMetadata).asset.id,
      bucket: "question-assets",
      objectPath: tabarniaManifest(accounts, avatarMetadata).asset.objectPath,
      metadata: sbrAssetMetadata,
    },
    ...Object.values(spainAssets).map((asset) => ({
      id: asset.assetId,
      bucket: "question-assets",
      objectPath: asset.objectPath,
      metadata: asset.metadata,
    })),
    ...tabarniaManifest(accounts, avatarMetadata).avatars.map((avatar) => ({
      id: avatar.assetId,
      bucket: "avatars",
      objectPath: avatar.objectPath,
      ownerPlayerId: accounts[avatar.label].playerId,
      metadata: avatarMetadata[avatar.label],
    })),
  ];
}

async function validateTabarniaDomain(
  client,
  accounts,
  avatarMetadata,
  spainAssets,
  sbrAssetMetadata,
  startsAt,
) {
  const data = tabarniaManifest(accounts, avatarMetadata, "production", startsAt);
  const room = (
    await client.query("select id::text, slug, title from public.rooms where id = $1", [
      data.room.id,
    ])
  ).rows[0];
  if (!room || room.slug !== "tabarnia" || room.title !== "Tabarnia") {
    throw new Error("La sala Tabarnia no coincide con lo esperado.");
  }

  const season = (
    await client.query(
      `select room_id::text, status, starts_at,
              extract(epoch from ends_at - starts_at)::integer as duration_seconds
         from public.seasons where id = $1`,
      [data.seasonId],
    )
  ).rows[0];
  if (
    !season ||
    season.room_id !== data.room.id ||
    season.status !== "active" ||
    season.duration_seconds <= 0
  ) {
    throw new Error("La temporada Tabarnia debe pertenecer a la sala y tener un intervalo válido.");
  }

  const role = (
    await client.query("select role from private.platform_role_assignments where player_id = $1", [
      accounts.xesmona.playerId,
    ])
  ).rows[0];
  if (role?.role !== "superadmin") throw new Error("Xesmona no tiene el rol superadmin esperado.");

  const memberships = (
    await client.query(
      "select player_id::text, role, status from public.room_memberships where room_id = $1",
      [data.room.id],
    )
  ).rows;
  const expectedMembers = data.playerLabels
    .map((label) => ({
      player_id: accounts[label].playerId,
      role: label === "ches" ? "owner" : "member",
      status: "active",
    }))
    .sort((left, right) => left.player_id.localeCompare(right.player_id));
  assertEqual(
    memberships
      .map((membership) => ({
        player_id: membership.player_id,
        role: membership.role,
        status: membership.status,
      }))
      .sort((left, right) => left.player_id.localeCompare(right.player_id)),
    expectedMembers,
    "La sala Tabarnia debe tener a Ches como propietario y quince miembros activos.",
  );

  const publications = (
    await client.query(
      `select scheduled.id::text, scheduled.number, scheduled.status,
              scheduled.challenge_version_id::text,
              extract(epoch from scheduled.opens_at - season.starts_at)::integer as opens_after_seconds,
              extract(epoch from scheduled.closes_at - scheduled.opens_at)::integer as duration_seconds,
              extract(epoch from season.ends_at - scheduled.closes_at)::integer as closes_before_end_seconds
         from public.scheduled_challenges scheduled
         join public.seasons season on season.id = scheduled.season_id
        where scheduled.season_id = $1
        order by scheduled.number`,
      [data.seasonId],
    )
  ).rows;
  if (publications.length !== data.publications.length) {
    throw new Error(
      `La temporada Tabarnia debe contener ${data.publications.length} publicaciones.`,
    );
  }

  let previousPublication = null;
  for (const [index, row] of publications.entries()) {
    const expected = data.publications[index];
    if (row.id !== expected.id || row.number !== expected.number) {
      throw new Error("El orden de las publicaciones de Tabarnia no coincide con el esperado.");
    }
    if (
      row.opens_after_seconds < 0 ||
      row.duration_seconds !== expected.durationMinutes * 60 ||
      row.closes_before_end_seconds < 0
    ) {
      throw new Error(
        `La publicación ${expected.number} debe durar 24 horas y quedar dentro de la temporada.`,
      );
    }
    if (
      previousPublication &&
      row.opens_after_seconds <
        previousPublication.opens_after_seconds + previousPublication.duration_seconds
    ) {
      throw new Error("Las ventanas de publicación de Tabarnia no pueden solaparse.");
    }
    previousPublication = row;
  }

  const publishedData = data.publications.map((item, index) => {
    const row = publications[index];
    if (
      row.challenge_version_id !== item.challengeVersionId &&
      !TABARNIA_LEGACY_VERSION_IDS[item.slug]?.includes(row.challenge_version_id)
    ) {
      throw new Error(`La publicación de ${item.title} referencia otra versión.`);
    }
    const opensAfterMinutes = row.opens_after_seconds / 60;
    const durationMinutes = row.duration_seconds / 60;
    return {
      ...item,
      opensAfterMinutes,
      durationMinutes,
      opensAfterHours: opensAfterMinutes / 60,
      durationHours: durationMinutes / 60,
      status: row.status,
      challengeVersionId: row.challenge_version_id,
    };
  });
  const challenges = (
    await client.query(
      `select version.id::text as version_id, version.title, version.mode, version.status,
              count(item.id)::integer as item_count, coalesce(sum(item.points), 0)::integer as points_total
         from private.challenge_versions version
         left join private.challenge_items item on item.challenge_version_id = version.id
        where version.id = any($1::uuid[])
        group by version.id, version.title, version.mode, version.status`,
      [data.publications.map((item) => item.challengeVersionId)],
    )
  ).rows;
  assertEqual(
    challenges.length,
    data.publications.length,
    "Deben existir todos los desafíos de Tabarnia.",
  );
  for (const expected of data.publications) {
    const actual = challenges.find((row) => row.version_id === expected.challengeVersionId);
    if (
      !actual ||
      actual.title !== expected.title ||
      actual.mode !== expected.mode ||
      actual.status !== "published" ||
      actual.item_count !== expected.questionCount ||
      actual.points_total !== expected.pointsTotal
    ) {
      throw new Error(`El desafío Tabarnia ${expected.title} no coincide con lo esperado.`);
    }
  }

  const assets = expectedAssets(accounts, avatarMetadata, spainAssets, sbrAssetMetadata);
  const assetRows = (
    await client.query(
      `select id::text, bucket_id, object_path, status, owner_player_id::text,
              byte_size, width, height, sha256
         from private.media_assets
        where id = any($1::uuid[])`,
      [assets.map((asset) => asset.id)],
    )
  ).rows;
  if (assetRows.length !== assets.length) throw new Error("Faltan assets registrados de Tabarnia.");
  for (const expected of assets) {
    const actual = assetRows.find((row) => row.id === expected.id);
    if (
      !actual ||
      actual.bucket_id !== expected.bucket ||
      actual.object_path !== expected.objectPath ||
      actual.status !== "ready" ||
      (expected.ownerPlayerId && actual.owner_player_id !== expected.ownerPlayerId) ||
      Number(actual.byte_size) !== expected.metadata.byteSize ||
      actual.width !== expected.metadata.width ||
      actual.height !== expected.metadata.height ||
      actual.sha256 !== expected.metadata.sha256
    ) {
      throw new Error(`El registro del asset Tabarnia ${expected.objectPath} no coincide.`);
    }
  }
  return {
    ...data,
    seasonStartsAt: new Date(season.starts_at).toISOString(),
    seasonDurationMinutes: season.duration_seconds / 60,
    publications: publishedData,
  };
}

async function applyTabarniaDomain(
  config,
  accounts,
  avatarMetadata,
  spainAssets,
  sbrAssetMetadata,
  startsAt,
  dependencies,
) {
  const runDatabase = dependencies.withDatabase ?? withStagingDatabase;
  return runDatabase(config, async (client) => {
    await client.query("begin");
    try {
      await client.query("set local statement_timeout = '30000ms'");
      if (startsAt) {
        const existingSeason = await client.query(
          "select starts_at = $2::timestamptz as matches from public.seasons where id = $1 for update",
          [tabarniaManifest(accounts, avatarMetadata).seasonId, startsAt],
        );
        if (existingSeason.rows[0] && existingSeason.rows[0].matches !== true) {
          throw new Error(
            "La temporada Tabarnia ya existe con otra fecha de inicio. El bootstrap conserva los datos existentes; para cambiar la fecha, usa el procedimiento de reinstalación de staging.",
          );
        }
        if (!existingSeason.rows[0]) validateFutureStartAt(startsAt);
      }
      await client.query(
        buildTabarniaDomainSql({
          accounts,
          sbrAssetMetadata,
          spainAssets,
          avatarMetadata,
          schedule: "production",
          startsAt,
          conflictSafe: true,
          wrapTransaction: false,
        }),
      );
      const data = await validateTabarniaDomain(
        client,
        accounts,
        avatarMetadata,
        spainAssets,
        sbrAssetMetadata,
        startsAt,
      );
      await client.query("commit");
      return data;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

async function writeManifest(config, accounts, manifestPath, data) {
  const users = Object.fromEntries(
    TABARNIA_USERS.map((user) => [
      user.label,
      {
        email: accounts[user.label].email,
        authUserId: accounts[user.label].authUserId,
        playerId: accounts[user.label].playerId,
        displayName: user.displayName,
        role: user.role,
      },
    ]),
  );
  await writeJsonSecure(manifestPath, {
    version: 1,
    scenario: "tabarnia",
    projectRef: config.projectRef,
    generatedAt: new Date().toISOString(),
    users,
    data,
  });
}

export async function runTabarniaBootstrap({
  env = process.env,
  args = [],
  dependencies = {},
} = {}) {
  const options = parseArgs(args);
  const config = validateStagingBootstrapConfig(env);
  const startsAt = normalizeStartAt(options.startsAt);
  if (options.dryRun) {
    validateFutureStartAt(startsAt);
    return {
      dryRun: true,
      scenario: "tabarnia",
      projectRef: config.projectRef,
      memberCount: 15,
      challengeCount: tabarniaChallengeCount(),
      ...(startsAt ? { seasonStartsAt: startsAt } : {}),
    };
  }

  const credentialsPath = dependencies.credentialsPath ?? STAGING_CREDENTIALS_PATH;
  const manifestPath = dependencies.manifestPath ?? DEFAULT_MANIFEST_PATH;
  await (dependencies.ensureFoundation ?? ensureStagingFoundation)(config, { dependencies });
  const { accounts } = await (dependencies.ensureAccounts ?? ensureStagingAccounts)(
    config,
    tabarniaAccountDefinitions(config),
    { credentialsPath, dependencies },
  );

  const service = (dependencies.adminClient ?? stagingAdminClient)(config);
  const prepareAssets = dependencies.prepareSpainAssets ?? prepareSpainAssets;
  const readSbrMetadata = dependencies.getSbrMapMetadata ?? getSbrMapMetadata;
  const readAvatar = dependencies.getAvatarMetadata ?? getAvatarMetadata;
  const preparedAssets = await prepareAssets();
  const uploadedObjects = [];
  try {
    const sbrAssetMetadata = await readSbrMetadata();
    const avatarMetadata = Object.fromEntries(
      await Promise.all(
        TABARNIA_USERS.filter((user) => user.avatarFile).map(async (user) => [
          user.label,
          await readAvatar(user),
        ]),
      ),
    );
    const storageObjects = [
      {
        bucket: "question-assets",
        objectPath: tabarniaManifest(accounts, avatarMetadata).asset.objectPath,
        filePath: SBR_MAP_PATH,
        metadata: sbrAssetMetadata,
      },
      ...Object.values(preparedAssets.assets).map((asset) => ({
        bucket: "question-assets",
        objectPath: asset.objectPath,
        filePath: asset.filePath,
        metadata: asset.metadata,
      })),
      ...TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => ({
        bucket: "avatars",
        objectPath: tabarniaManifest(accounts, avatarMetadata).avatars.find(
          (avatar) => avatar.label === user.label,
        ).objectPath,
        filePath: avatarMetadata[user.label].filePath,
        metadata: avatarMetadata[user.label],
      })),
    ];
    for (const object of storageObjects) {
      await (dependencies.ensureStorageObject ?? ensureStorageObject)(
        service,
        object,
        uploadedObjects,
      );
    }

    let data;
    try {
      data = await applyTabarniaDomain(
        config,
        accounts,
        avatarMetadata,
        preparedAssets.assets,
        sbrAssetMetadata,
        startsAt,
        dependencies,
      );
    } catch (error) {
      await (dependencies.removeUploadedObjects ?? removeUploadedObjects)(service, uploadedObjects);
      throw error;
    }
    await (dependencies.writeManifest ?? writeManifest)(config, accounts, manifestPath, data);

    return {
      dryRun: false,
      projectRef: config.projectRef,
      ...(startsAt ? { seasonStartsAt: startsAt } : {}),
      credentialsPath,
      manifestPath,
    };
  } finally {
    await preparedAssets.cleanup();
  }
}

async function main() {
  const args = process.argv.slice(2);
  loadStagingBootstrapEnv(parseArgs(args));
  const result = await runTabarniaBootstrap({ args });
  if (result.dryRun) {
    console.log(`Dry-run correcto para Tabarnia en ${result.projectRef}. No se ha escrito nada.`);
    console.log(
      `Escenario: ${result.challengeCount} desafíos y ${result.memberCount} miembros; el inicio configurado es válido.`,
    );
    if (result.seasonStartsAt) console.log(`Inicio de temporada: ${result.seasonStartsAt}.`);
    return;
  }
  console.log("Bootstrap de Tabarnia en staging completado.");
  if (result.seasonStartsAt) console.log(`Inicio de temporada: ${result.seasonStartsAt}.`);
  console.log(`Credenciales compartidas: ${result.credentialsPath}`);
  console.log(`Manifiesto: ${result.manifestPath}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Falló el bootstrap de Tabarnia.");
    process.exitCode = 1;
  });
}
