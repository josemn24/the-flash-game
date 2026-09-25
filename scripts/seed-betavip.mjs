import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { BETA_VIP_ALPHABET } from "./fixtures/scenarios/betavip-alphabet.mjs";
import {
  BETA_VIP_SURVIVAL,
  betaVipSurvivalQuestions,
} from "./fixtures/scenarios/betavip-survival.mjs";
import {
  BETA_VIP_PYRAMID,
  betaVipPyramidQuestions,
} from "./fixtures/scenarios/betavip-pyramid.mjs";
import {
  createAuthAccounts,
  deterministicUuid,
  dockerSql,
  localSupabaseConfig,
  readFixture,
  removeStorageObject,
  sqlString,
  uploadStorageObject,
  writeFixture,
} from "./support/supabase-local.mjs";
import { setupTabarniaDataset } from "./seed-tabarnia.mjs";

const namespace = "the-flash-game:betavip";
const cassetteAssetId = stableId("question-asset:betavip-pop-culture-cassette");
const cassetteObjectPath = `question-assets/${cassetteAssetId}.png`;
const newUsers = [
  { label: "manuel", displayName: "Manuel" },
  { label: "genis", displayName: "Genís" },
];

function stableId(label) {
  return deterministicUuid(namespace, label);
}

const alphabetItems = BETA_VIP_ALPHABET.entries.map((entry, index) => {
  const slug = `alphabet-betavip-world-${entry.letter.toLowerCase()}`;
  return {
    ...entry,
    slug,
    points: index < 10 ? 6 : 5,
    definitionId: stableId(`question:${slug}`),
    versionId: stableId(`question-version:${slug}`),
    itemId: stableId(`challenge-item:${slug}`),
  };
});
const survivalItems = betaVipSurvivalQuestions(cassetteAssetId).map((item) => ({
  ...item,
  definitionId: stableId(`question:${item.slug}`),
  versionId: stableId(`question-version:${item.slug}`),
  itemId: stableId(`challenge-item:${item.slug}`),
}));
const pyramidItems = betaVipPyramidQuestions.map((item, index) => ({
  ...item,
  position: index + 1,
  definitionId: stableId(`question:${item.slug}`),
  versionId: stableId(`question-version:${item.slug}`),
  itemId: stableId(`challenge-item:${item.slug}`),
}));

async function prepareCassetteAsset() {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "betavip-cassette-"));
  try {
    const svg = await readFile(path.resolve("public/visuals/betavip/audio-medium.svg"));
    const bytes = await sharp(svg).resize(1200, 800).png().toBuffer();
    const image = await sharp(bytes).metadata();
    if (image.format !== "png" || image.width !== 1200 || image.height !== 800) {
      throw new Error("La ilustración del casete no se ha generado en PNG de 1200 × 800.");
    }
    const filePath = path.join(tempDirectory, "audio-medium.png");
    await writeFile(filePath, bytes);
    return {
      filePath,
      metadata: {
        mimeType: "image/png",
        byteSize: bytes.byteLength,
        width: image.width,
        height: image.height,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      cleanup: () => rm(tempDirectory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(tempDirectory, { recursive: true, force: true });
    throw error;
  }
}

function steelBallRun(tabarniaFixture) {
  const publication = tabarniaFixture.data.publications.find(
    (item) => item.slug === "steel-ball-run",
  );
  if (publication?.mode !== "flash" || publication.questionCount !== 16) {
    throw new Error("La fixture de Tabarnia no contiene Steel Ball Run Flash con 16 preguntas.");
  }
  return publication;
}

export function betaVipManifest(tabarniaFixture) {
  const steel = steelBallRun(tabarniaFixture);
  const pyramid = {
    id: stableId("publication:beta-vip-cumbre-logica-ii"),
    number: 1,
    slug: BETA_VIP_PYRAMID.slug,
    title: BETA_VIP_PYRAMID.title,
    mode: "pyramid",
    challengeId: stableId(`challenge:${BETA_VIP_PYRAMID.slug}`),
    challengeVersionId: stableId(`challenge-version:${BETA_VIP_PYRAMID.slug}-v1`),
    questionCount: pyramidItems.length,
    pointsTotal: pyramidItems.reduce((total, item) => total + item.points, 0),
    opensAfterHours: 0,
    durationHours: 24,
    status: "open",
  };
  const alphabet = {
    id: stableId("publication:beta-vip-la-vuelta-al-mundo"),
    number: 3,
    slug: BETA_VIP_ALPHABET.slug,
    title: BETA_VIP_ALPHABET.title,
    mode: "alphabet",
    challengeId: stableId(`challenge:${BETA_VIP_ALPHABET.definitionSlug}`),
    challengeVersionId: stableId(`challenge-version:${BETA_VIP_ALPHABET.definitionSlug}-v1`),
    questionCount: alphabetItems.length,
    pointsTotal: alphabetItems.reduce((total, item) => total + item.points, 0),
    opensAfterHours: 48,
    durationHours: 24,
    status: "scheduled",
  };
  const survivalPublication = {
    id: stableId("publication:beta-vip-pop-culture-survival"),
    number: 2,
    slug: BETA_VIP_SURVIVAL.slug,
    title: BETA_VIP_SURVIVAL.title,
    mode: "survival",
    challengeId: stableId(`challenge:${BETA_VIP_SURVIVAL.slug}`),
    challengeVersionId: stableId(`challenge-version:${BETA_VIP_SURVIVAL.slug}-v1`),
    questionCount: survivalItems.length,
    pointsTotal: survivalItems.reduce((total, item) => total + item.points, 0),
    opensAfterHours: 24,
    durationHours: 24,
    status: "scheduled",
  };
  return {
    room: { id: stableId("room:beta-vip"), slug: "beta-vip" },
    seasonId: stableId("season:beta-vip"),
    publicationId: pyramid.id,
    challengeId: pyramid.challengeId,
    challengeVersionId: pyramid.challengeVersionId,
    questionCount: pyramid.questionCount,
    pointsTotal: pyramid.pointsTotal,
    pyramidPublicationId: pyramid.id,
    alphabetPublicationId: alphabet.id,
    survivalPublicationId: survivalPublication.id,
    publications: [pyramid, survivalPublication, alphabet],
    questionAssets: [
      {
        id: cassetteAssetId,
        bucket: "question-assets",
        objectPath: cassetteObjectPath,
        mimeType: "image/png",
      },
    ],
    tabarnia: {
      room: tabarniaFixture.data.room,
      seasonId: tabarniaFixture.data.seasonId,
      steelBallRunPublicationId: steel.id,
    },
  };
}

export function buildBetaVipDomainSql({ tabarniaFixture, accounts, cassetteAssetMetadata }) {
  const data = betaVipManifest(tabarniaFixture);
  const players = {
    ches: tabarniaFixture.users.ches?.playerId,
    dark: tabarniaFixture.users.dark?.playerId,
    manuel: accounts.manuel?.playerId,
    genis: accounts.genis?.playerId,
  };
  if (Object.values(players).some((playerId) => !playerId)) {
    throw new Error("Faltan jugadores de Tabarnia o BetaVIP para crear la sala compartida.");
  }
  const authorId = tabarniaFixture.users.xesmona?.playerId;
  if (!authorId) {
    throw new Error("Falta Xesmona para publicar el Alphabet de BetaVIP.");
  }
  const alphabet = data.publications.find((publication) => publication.mode === "alphabet");
  const survival = data.publications.find((publication) => publication.mode === "survival");
  const pyramid = data.publications.find((publication) => publication.mode === "pyramid");
  if (!cassetteAssetMetadata) {
    throw new Error("Faltan metadatos del recurso de imagen de BetaVIP.");
  }
  const questionDefinitions = [...alphabetItems, ...survivalItems, ...pyramidItems]
    .map(
      (item) =>
        `(${sqlString(item.definitionId)}, ${sqlString(item.slug)}, ${sqlString(authorId)})`,
    )
    .join(",\n");
  const alphabetQuestionVersions = alphabetItems
    .map((item) => {
      const publicPayload = {
        category: "Geografía",
        tags: {
          domains: ["geography"],
          topics: [item.topic],
          cognitiveSkills: ["memory"],
          formatSkills: ["recall"],
          lifeSkills: [],
        },
        question: item.prompt,
      };
      return `(${sqlString(item.versionId)}, ${sqlString(item.definitionId)}, 1, 1, 'draft', 'short-text', ${BETA_VIP_ALPHABET.questionTimeLimitMs}, ${sqlString(JSON.stringify(publicPayload))}, ${sqlString(authorId)})`;
    })
    .join(",\n");
  const survivalQuestionVersions = survivalItems
    .map(
      (item) =>
        `(${sqlString(item.versionId)}, ${sqlString(item.definitionId)}, 1, ${item.payloadSchemaVersion}, 'draft', ${sqlString(item.type)}, ${item.timeLimitMs}, ${sqlString(JSON.stringify(item.publicPayload))}, ${sqlString(authorId)})`,
    )
    .join(",\n");
  const pyramidQuestionVersions = pyramidItems
    .map(
      (item) =>
        `(${sqlString(item.versionId)}, ${sqlString(item.definitionId)}, 1, ${item.payloadSchemaVersion}, 'draft', ${sqlString(item.type)}, ${item.timeLimitMs}, ${sqlString(JSON.stringify(item.publicPayload))}, ${sqlString(authorId)})`,
    )
    .join(",\n");
  const alphabetQuestionSolutions = alphabetItems
    .map((item) => {
      const solutionPayload = {
        correctAnswer: item.correctAnswer,
        acceptedAnswers: item.acceptedAnswers,
        explanation: item.explanation,
      };
      return `(${sqlString(item.versionId)}, ${sqlString(JSON.stringify(solutionPayload))})`;
    })
    .join(",\n");
  const survivalQuestionSolutions = survivalItems
    .map(
      (item) =>
        `(${sqlString(item.versionId)}, ${sqlString(JSON.stringify(item.solutionPayload))})`,
    )
    .join(",\n");
  const pyramidQuestionSolutions = pyramidItems
    .map(
      (item) =>
        `(${sqlString(item.versionId)}, ${sqlString(JSON.stringify(item.solutionPayload))})`,
    )
    .join(",\n");
  const alphabetChallengeItems = alphabetItems
    .map(
      (item, index) =>
        `(${sqlString(item.itemId)}, ${sqlString(alphabet.challengeVersionId)}, ${sqlString(item.versionId)}, ${index + 1}, ${item.points}, 1, ${sqlString(JSON.stringify({ letter: item.letter }))})`,
    )
    .join(",\n");
  const survivalChallengeItems = survivalItems
    .map(
      (item) =>
        `(${sqlString(item.itemId)}, ${sqlString(survival.challengeVersionId)}, ${sqlString(item.versionId)}, ${item.position}, ${item.points}, 1, '{}')`,
    )
    .join(",\n");
  const pyramidChallengeItems = pyramidItems
    .map(
      (item) =>
        `(${sqlString(item.itemId)}, ${sqlString(pyramid.challengeVersionId)}, ${sqlString(item.versionId)}, ${item.position}, ${item.points}, 1, ${sqlString(JSON.stringify({ levelId: `cumbre-logica-ii-${item.position}`, label: ["Entrada", "Patrón", "Recorrido", "Conexiones", "Escape", "Cerradura", "Cima"][item.position - 1], briefing: { title: item.publicPayload.question, format: item.type, description: "Resuelve este tramo y desbloquea el siguiente." } }))})`,
    )
    .join(",\n");

  return `
begin;
set constraints all deferred;
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlString(data.room.id)}, 'beta-vip', 'BetaVIP', 'Sala privada de pruebas BetaVIP.', 'Europe/Madrid', 'active');

insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlString(data.room.id)}, ${sqlString(players.ches)}, 'owner', 'active', now()),
  (${sqlString(data.room.id)}, ${sqlString(players.manuel)}, 'member', 'active', now()),
  (${sqlString(data.room.id)}, ${sqlString(players.genis)}, 'member', 'active', now()),
  (${sqlString(data.room.id)}, ${sqlString(players.dark)}, 'member', 'active', now());

insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlString(data.seasonId)}, ${sqlString(data.room.id)}, 'Temporada BetaVIP', 'active', now(), now() + interval '72 hours');

insert into private.media_assets
  (id, bucket_id, object_path, kind, status, created_by_player_id, mime_type, byte_size, width, height, sha256)
values (${sqlString(cassetteAssetId)}, 'question-assets', ${sqlString(cassetteObjectPath)}, 'question-asset', 'ready', ${sqlString(authorId)}, 'image/png', ${cassetteAssetMetadata.byteSize}, 1200, 800, ${sqlString(cassetteAssetMetadata.sha256)});

insert into private.question_definitions (id, slug, created_by_player_id)
values
${questionDefinitions};

insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type,
   time_limit_ms, public_payload, created_by_player_id)
values
${alphabetQuestionVersions},
${survivalQuestionVersions},
${pyramidQuestionVersions};

insert into private.question_version_solutions (question_version_id, solution_payload)
values
${alphabetQuestionSolutions},
${survivalQuestionSolutions},
${pyramidQuestionSolutions};

update private.question_versions
set status = 'published', published_at = now()
where id in (${[...alphabetItems, ...survivalItems, ...pyramidItems].map((item) => sqlString(item.versionId)).join(", ")});

insert into private.challenge_definitions (id, slug, created_by_player_id)
values
  (${sqlString(alphabet.challengeId)}, ${sqlString(BETA_VIP_ALPHABET.definitionSlug)}, ${sqlString(authorId)}),
  (${sqlString(survival.challengeId)}, ${sqlString(BETA_VIP_SURVIVAL.slug)}, ${sqlString(authorId)}),
  (${sqlString(pyramid.challengeId)}, ${sqlString(BETA_VIP_PYRAMID.slug)}, ${sqlString(authorId)});

insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, global_time_limit_ms, mode_config,
   created_by_player_id, published_at)
values
  (${sqlString(alphabet.challengeVersionId)}, ${sqlString(alphabet.challengeId)}, 1, 1, 'draft',
   'alphabet', ${sqlString(BETA_VIP_ALPHABET.title)}, ${sqlString(BETA_VIP_ALPHABET.subtitle)},
   ${sqlString(BETA_VIP_ALPHABET.description)}, 100, ${BETA_VIP_ALPHABET.globalTimeLimitMs}, '{}',
   ${sqlString(authorId)}, null),
  (${sqlString(survival.challengeVersionId)}, ${sqlString(survival.challengeId)}, 1, 1, 'draft',
   'survival', ${sqlString(BETA_VIP_SURVIVAL.title)}, ${sqlString(BETA_VIP_SURVIVAL.subtitle)},
   ${sqlString(BETA_VIP_SURVIVAL.description)}, 100, null, ${sqlString(JSON.stringify(BETA_VIP_SURVIVAL.modeConfig))},
   ${sqlString(authorId)}, null),
  (${sqlString(pyramid.challengeVersionId)}, ${sqlString(pyramid.challengeId)}, 1, 1, 'draft',
   'pyramid', ${sqlString(BETA_VIP_PYRAMID.title)}, ${sqlString(BETA_VIP_PYRAMID.subtitle)},
   ${sqlString(BETA_VIP_PYRAMID.description)}, 100, null, '{}',
   ${sqlString(authorId)}, null);

insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
${alphabetChallengeItems},
${survivalChallengeItems},
${pyramidChallengeItems};

update private.challenge_versions
set status = 'published', published_at = now()
where id in (${sqlString(alphabet.challengeVersionId)}, ${sqlString(survival.challengeVersionId)}, ${sqlString(pyramid.challengeVersionId)});

select private.assert_supported_calendar_content(${sqlString(survival.challengeVersionId)});
select private.assert_supported_calendar_content(${sqlString(pyramid.challengeVersionId)});

insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values
  (${sqlString(pyramid.id)}, ${sqlString(data.seasonId)}, ${sqlString(pyramid.challengeVersionId)}, 1,
   'open', now(), now() + interval '24 hours'),
  (${sqlString(survival.id)}, ${sqlString(data.seasonId)}, ${sqlString(survival.challengeVersionId)}, 2,
   'scheduled', now() + interval '24 hours', now() + interval '48 hours'),
  (${sqlString(alphabet.id)}, ${sqlString(data.seasonId)}, ${sqlString(alphabet.challengeVersionId)}, 3,
   'scheduled', now() + interval '48 hours', now() + interval '72 hours');
set constraints all immediate;
commit;
`;
}

export async function setupBetaVipDataset({ dependencies = {} } = {}) {
  const seedTabarnia = dependencies.setupTabarniaDataset ?? setupTabarniaDataset;
  const loadConfig = dependencies.localSupabaseConfig ?? localSupabaseConfig;
  const loadFixture = dependencies.readFixture ?? readFixture;
  const createAccounts = dependencies.createAuthAccounts ?? createAuthAccounts;
  const runSql = dependencies.dockerSql ?? dockerSql;
  const saveFixture = dependencies.writeFixture ?? writeFixture;
  const prepareAsset = dependencies.prepareCassetteAsset ?? prepareCassetteAsset;
  const uploadAsset = dependencies.uploadStorageObject ?? uploadStorageObject;
  const removeAsset = dependencies.removeStorageObject ?? removeStorageObject;

  await seedTabarnia();
  const tabarniaFixture = await loadFixture("tabarnia");
  const config = await loadConfig({ requireServiceRole: true });
  const accounts = await createAccounts({ id: "betavip", users: newUsers }, config);
  const preparedAsset = await prepareAsset();
  const storageObject = {
    bucket: "question-assets",
    objectPath: cassetteObjectPath,
    filePath: preparedAsset.filePath,
    contentType: "image/png",
  };
  try {
    await uploadAsset(config, { ...storageObject, upsert: true });
    await runSql(
      buildBetaVipDomainSql({
        tabarniaFixture,
        accounts,
        cassetteAssetMetadata: preparedAsset.metadata,
      }),
      config.dbContainer,
    );
  } catch (error) {
    try {
      await removeAsset(config, storageObject);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Falló BetaVIP y la limpieza del recurso.");
    }
    throw error;
  } finally {
    await preparedAsset.cleanup();
  }

  const data = betaVipManifest(tabarniaFixture);
  const users = {
    xesmona: tabarniaFixture.users.xesmona,
    ches: tabarniaFixture.users.ches,
    dark: tabarniaFixture.users.dark,
    manuel: { ...accounts.manuel, displayName: "Manuel", role: "member" },
    genis: { ...accounts.genis, displayName: "Genís", role: "member" },
  };
  await saveFixture("betavip", {
    version: 1,
    scenario: "betavip",
    generatedAt: new Date().toISOString(),
    users,
    data,
  });
  return data;
}

async function main() {
  const data = await setupBetaVipDataset();
  console.log("Datasets Tabarnia y BetaVIP creados en output/fixtures/.");
  console.log(`Salas: /salas/tabarnia y /salas/${data.room.slug}`);
  console.log(`/desafios/${data.publicationId}?roomId=${data.room.slug}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
