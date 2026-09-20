import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SBR_QUESTIONS } from "./fixtures/scenarios/sbr.mjs";
import {
  createFixedAuthAccounts,
  deterministicUuid,
  dockerSql,
  localSupabaseConfig,
  removeStorageObject,
  resetLocalDatabase,
  sqlString,
  uploadStorageObject,
  writeFixture,
} from "./support/supabase-local.mjs";

const namespace = "the-flash-game:tabarnia";
const mapPath = path.resolve("public/visuals/sbr/usa-location-map.png");
const assetLabel = "question-asset:tabarnia-sbr-grand-canyon-heat-map";

export const TABARNIA_USERS = [
  {
    label: "xesmona",
    email: "xesmona@tabarnia.local",
    password: "Tabarnia-local-Xesmona-123!",
    displayName: "xesmona",
    role: "superadmin",
  },
  {
    label: "ches",
    email: "ches@tabarnia.local",
    password: "Tabarnia-local-Ches-123!",
    displayName: "Ches",
    role: "owner",
  },
  {
    label: "dark",
    email: "dark@tabarnia.local",
    password: "Tabarnia-local-Dark-123!",
    displayName: "Dark",
    role: "member",
  },
  {
    label: "palmera",
    email: "palmera@tabarnia.local",
    password: "Tabarnia-local-Palmera-123!",
    displayName: "Palmera",
    role: "member",
  },
  {
    label: "carlos",
    email: "carlos@tabarnia.local",
    password: "Tabarnia-local-Carlos-123!",
    displayName: "Carlos",
    role: "member",
  },
  {
    label: "kike",
    email: "kike@tabarnia.local",
    password: "Tabarnia-local-Kike-123!",
    displayName: "Kike",
    role: "member",
  },
  {
    label: "javi",
    email: "javi@tabarnia.local",
    password: "Tabarnia-local-Javi-123!",
    displayName: "Javi",
    role: "member",
  },
  {
    label: "rielbe",
    email: "rielbe@tabarnia.local",
    password: "Tabarnia-local-Rielbe-123!",
    displayName: "Rielbe",
    role: "member",
  },
  {
    label: "alejandro",
    email: "alejandro@tabarnia.local",
    password: "Tabarnia-local-Alejandro-123!",
    displayName: "Alejandro",
    role: "member",
  },
  {
    label: "jacobo",
    email: "jacobo@tabarnia.local",
    password: "Tabarnia-local-Jacobo-123!",
    displayName: "Jacobo",
    role: "member",
  },
  {
    label: "lambda",
    email: "lambda@tabarnia.local",
    password: "Tabarnia-local-Lambda-123!",
    displayName: "Lambda",
    role: "member",
  },
  {
    label: "jhon3d",
    email: "jhon3d@tabarnia.local",
    password: "Tabarnia-local-Jhon3D-123!",
    displayName: "Jhon3D",
    role: "member",
  },
  {
    label: "diego",
    email: "diego@tabarnia.local",
    password: "Tabarnia-local-Diego-123!",
    displayName: "Diego",
    role: "member",
  },
];

const playerLabels = TABARNIA_USERS.filter((user) => user.role !== "superadmin").map(
  (user) => user.label,
);

function stableId(label) {
  return deterministicUuid(namespace, label);
}

function assertLocalTabarniaUrl(value) {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`El setup de Tabarnia solo admite Supabase local: ${url.origin}`);
  }
}

async function getMapMetadata() {
  const bytes = await readFile(mapPath);
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== "png" || metadata.width !== 1859 || metadata.height !== 968) {
    throw new Error(
      `El asset SBR no tiene el formato esperado: ${metadata.format} ${metadata.width}x${metadata.height}`,
    );
  }
  return {
    byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: metadata.width,
    height: metadata.height,
  };
}

export function buildTabarniaDomainSql({ accounts, assetMetadata }) {
  const xesmona = accounts.xesmona.playerId;
  const assetId = stableId(assetLabel);
  const questions = SBR_QUESTIONS.map((item) => ({
    ...item,
    publicPayload: JSON.parse(
      JSON.stringify(item.publicPayload).replaceAll("__SBR_ASSET_ID__", assetId),
    ),
  }));
  const questionDefinitionSql = questions
    .map(
      (item) =>
        `(${sqlString(stableId(`question:${item.slug}`))}, ${sqlString(item.slug)}, ${sqlString(xesmona)})`,
    )
    .join(",\n");
  const questionVersionSql = questions
    .map(
      (item) =>
        `(${sqlString(stableId(`question-version:${item.slug}`))}, ${sqlString(stableId(`question:${item.slug}`))}, 1, ${item.payloadSchemaVersion}, 'draft', ${sqlString(item.type)}, ${item.timeLimitMs}, ${sqlString(JSON.stringify(item.publicPayload))}, ${sqlString(xesmona)})`,
    )
    .join(",\n");
  const solutionSql = questions
    .map(
      (item) =>
        `(${sqlString(stableId(`question-version:${item.slug}`))}, ${sqlString(JSON.stringify(item.solutionPayload))})`,
    )
    .join(",\n");
  const challengeItemSql = questions
    .map(
      (item, index) =>
        `(${sqlString(stableId(`challenge-item:${item.slug}`))}, ${sqlString(stableId("challenge-version:steel-ball-run-v1"))}, ${sqlString(stableId(`question-version:${item.slug}`))}, ${index + 1}, ${item.points}, 1, '{}')`,
    )
    .join(",\n");
  const publishedQuestionIds = questions
    .map((item) => sqlString(stableId(`question-version:${item.slug}`)))
    .join(", ");
  const roomId = stableId("room:tabarnia");
  const seasonId = stableId("season:tabarnia-alpha");
  const challengeDefinitionId = stableId("challenge-definition:steel-ball-run");
  const challengeVersionId = stableId("challenge-version:steel-ball-run-v1");
  const publicationId = stableId("publication:steel-ball-run");

  const memberships = playerLabels
    .map(
      (label) =>
        `(${sqlString(roomId)}, ${sqlString(accounts[label].playerId)}, ${sqlString(label === "ches" ? "owner" : "member")}, 'active', now())`,
    )
    .join(",\n");

  return `
begin;
set constraints all deferred;

insert into private.platform_role_assignments (player_id, role)
values (${sqlString(xesmona)}, 'superadmin');

insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlString(roomId)}, 'tabarnia', 'Tabarnia', 'Sala privada de la alpha de The Flash.', 'Europe/Madrid', 'active');

insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
${memberships};

insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlString(seasonId)}, ${sqlString(roomId)}, 'Temporada Alpha de Tabarnia', 'active', now(), now() + interval '17 days');

insert into private.media_assets
  (id, bucket_id, object_path, kind, status, created_by_player_id, mime_type, byte_size, width, height, sha256)
values
  (${sqlString(assetId)}, 'question-assets', ${sqlString(`question-assets/${assetId}.png`)}, 'question-asset', 'ready',
   ${sqlString(xesmona)}, 'image/png', ${assetMetadata.byteSize}, ${assetMetadata.width}, ${assetMetadata.height}, ${sqlString(assetMetadata.sha256)});

insert into private.question_definitions (id, slug, created_by_player_id)
values
${questionDefinitionSql};

insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type,
   time_limit_ms, public_payload, created_by_player_id)
values
${questionVersionSql};

insert into private.question_version_solutions (question_version_id, solution_payload)
values
${solutionSql};

update private.question_versions
set status = 'published', published_at = now()
where id in (${publishedQuestionIds});

insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlString(challengeDefinitionId)}, 'tabarnia-flash-01', ${sqlString(xesmona)});

insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (
  ${sqlString(challengeVersionId)}, ${sqlString(challengeDefinitionId)}, 1, 1, 'draft', 'flash',
  'Steel Ball Run', 'Carrera, ingenio y reflejos',
  'Dieciséis retos rápidos para la primera temporada de Tabarnia.',
  100, '{}', ${sqlString(xesmona)}, null
);

insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
${challengeItemSql};

update private.challenge_versions
set status = 'published', published_at = now()
where id = ${sqlString(challengeVersionId)};

insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (
  ${sqlString(publicationId)}, ${sqlString(seasonId)}, ${sqlString(challengeVersionId)}, 1,
  'open', now(), now() + interval '24 hours'
);

set constraints all immediate;
commit;
`;
}

export function tabarniaManifest() {
  return {
    room: { id: stableId("room:tabarnia"), slug: "tabarnia" },
    seasonId: stableId("season:tabarnia-alpha"),
    challengeId: stableId("challenge-definition:steel-ball-run"),
    challengeVersionId: stableId("challenge-version:steel-ball-run-v1"),
    publicationId: stableId("publication:steel-ball-run"),
    questionCount: SBR_QUESTIONS.length,
    pointsTotal: SBR_QUESTIONS.reduce((total, item) => total + item.points, 0),
    asset: {
      id: stableId(assetLabel),
      bucket: "question-assets",
      objectPath: `question-assets/${stableId(assetLabel)}.png`,
    },
    playerLabels,
    superadminLabel: "xesmona",
    ownerLabel: "ches",
  };
}

export async function setupTabarniaDataset({ dependencies = {} } = {}) {
  const loadConfig = dependencies.localSupabaseConfig ?? localSupabaseConfig;
  const reset = dependencies.resetLocalDatabase ?? resetLocalDatabase;
  const createAccounts = dependencies.createFixedAuthAccounts ?? createFixedAuthAccounts;
  const runSql = dependencies.dockerSql ?? dockerSql;
  const saveFixture = dependencies.writeFixture ?? writeFixture;
  const uploadAsset = dependencies.uploadStorageObject ?? uploadStorageObject;
  const removeAsset = dependencies.removeStorageObject ?? removeStorageObject;
  const readAssetMetadata = dependencies.getMapMetadata ?? getMapMetadata;

  const config = await loadConfig({ requireServiceRole: true });
  assertLocalTabarniaUrl(config.url);
  await reset();

  const accounts = await createAccounts(TABARNIA_USERS, config);
  const assetId = stableId(assetLabel);
  let storageSeeded = false;

  try {
    const assetMetadata = await readAssetMetadata();
    await uploadAsset(config, {
      bucket: "question-assets",
      objectPath: `question-assets/${assetId}.png`,
      filePath: mapPath,
      contentType: "image/png",
    });
    storageSeeded = true;
    await runSql(buildTabarniaDomainSql({ accounts, assetMetadata }), config.dbContainer);

    const output = tabarniaManifest();
    await saveFixture("tabarnia", {
      version: 1,
      scenario: "tabarnia",
      generatedAt: new Date().toISOString(),
      users: Object.fromEntries(
        TABARNIA_USERS.map((user) => [
          user.label,
          {
            email: accounts[user.label].email,
            password: accounts[user.label].password,
            playerId: accounts[user.label].playerId,
            displayName: user.displayName,
            role: user.role,
          },
        ]),
      ),
      data: output,
    });
    return output;
  } catch (error) {
    if (storageSeeded) {
      await Promise.resolve(
        removeAsset(config, {
          bucket: "question-assets",
          objectPath: `question-assets/${assetId}.png`,
        }),
      ).catch(() => undefined);
    }
    throw error;
  }
}

async function main() {
  const output = await setupTabarniaDataset();
  console.log("Dataset Tabarnia creado en output/fixtures/tabarnia.json.");
  console.log("Sala: /salas/tabarnia");
  console.log(`/desafios/${output.publicationId}?roomId=tabarnia`);
  console.log("Credenciales locales:");
  for (const user of TABARNIA_USERS) {
    console.log(`  ${user.displayName}: ${user.email} / ${user.password} (${user.role})`);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
