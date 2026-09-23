import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import TABARNIA_MOCK_CONTENT from "./fixtures/scenarios/tabarnia-content.json" with { type: "json" };
import { SBR_QUESTIONS } from "./fixtures/scenarios/sbr.mjs";
import { loadMiniWordleDictionary } from "./load-mini-wordle-dictionary.mjs";
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
const sbrMapPath = path.resolve("public/visuals/sbr/usa-location-map.png");
const questionAssetDefinitions = [
  {
    key: "canaryMap",
    label: "question-asset:tabarnia-spain-canary-map",
    sourcePath: path.resolve("public/visuals/spain-survival/canary_islands_map.svg"),
    fileName: "canary-islands.png",
    mimeType: "image/png",
    width: 1475,
    height: 655,
  },
  {
    key: "sagrada",
    label: "question-asset:tabarnia-spain-sagrada-familia",
    sourcePath: path.resolve("public/visuals/spain-survival/sagrada-familia.jpg"),
    fileName: "sagrada-familia.jpg",
    mimeType: "image/jpeg",
    width: 1920,
    height: 1271,
  },
  {
    key: "meninas",
    label: "question-asset:tabarnia-spain-las-meninas",
    sourcePath: path.resolve("public/visuals/spain-survival/las-meninas-velazquez.jpg"),
    fileName: "las-meninas.jpg",
    mimeType: "image/jpeg",
    width: 954,
    height: 951,
  },
];
const avatarDirectory = path.resolve("public/flash-pop/avatars");
const avatarMimeTypes = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

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
    avatarFile: "dark.jpeg",
  },
  {
    label: "palmera",
    email: "palmera@tabarnia.local",
    password: "Tabarnia-local-Palmera-123!",
    displayName: "Palmera",
    role: "member",
    avatarFile: "palmera.jpeg",
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
    avatarFile: "kike.jpeg",
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
    avatarFile: "rielbe.jpeg",
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
    avatarFile: "jacobo.jpeg",
  },
  {
    label: "lambda",
    email: "lambda@tabarnia.local",
    password: "Tabarnia-local-Lambda-123!",
    displayName: "Lambda",
    role: "member",
    avatarFile: "lambda.jpg",
  },
  {
    label: "jhon3d",
    email: "jhon3d@tabarnia.local",
    password: "Tabarnia-local-Jhon3D-123!",
    displayName: "Jhon3D",
    role: "member",
    avatarFile: "jhon3d.jpg",
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

async function getImageMetadataFromBytes(
  bytes,
  label,
  { expectedFormat, expectedWidth, expectedHeight } = {},
) {
  const metadata = await sharp(bytes).metadata();
  const mimeType = avatarMimeTypes[metadata.format];
  if (!mimeType || !metadata.width || !metadata.height || bytes.byteLength <= 0) {
    throw new Error(`El asset de imagen no es válido: ${label}`);
  }
  if (
    (expectedFormat && metadata.format !== expectedFormat) ||
    (expectedWidth && metadata.width !== expectedWidth) ||
    (expectedHeight && metadata.height !== expectedHeight)
  ) {
    throw new Error(
      `El asset no tiene el formato esperado: ${label} ${metadata.format} ${metadata.width}x${metadata.height}`,
    );
  }
  return {
    byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    mimeType,
  };
}

async function getImageMetadata(filePath, expected = {}) {
  return getImageMetadataFromBytes(await readFile(filePath), filePath, expected);
}

async function prepareSpainAssets() {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "tabarnia-spain-assets-"));
  try {
    const assets = {};
    for (const definition of questionAssetDefinitions) {
      let bytes = await readFile(definition.sourcePath);
      if (definition.key === "canaryMap") {
        bytes = await sharp(bytes)
          .resize({ width: definition.width, height: definition.height, fit: "inside" })
          .png()
          .toBuffer();
      }
      const extension = path.extname(definition.fileName).slice(1);
      const filePath = path.join(tempDirectory, definition.fileName);
      await writeFile(filePath, bytes);
      const metadata = await getImageMetadataFromBytes(bytes, definition.sourcePath, {
        expectedFormat: extension === "jpg" ? "jpeg" : extension,
        expectedWidth: definition.width,
        expectedHeight: definition.height,
      });
      assets[definition.key] = {
        ...definition,
        filePath,
        metadata,
        assetId: stableId(definition.label),
        objectPath: `question-assets/${stableId(definition.label)}.${extension}`,
      };
    }
    return { assets, cleanup: () => rm(tempDirectory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(tempDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function getSbrMapMetadata() {
  return getImageMetadata(sbrMapPath, {
    expectedFormat: "png",
    expectedWidth: 1859,
    expectedHeight: 968,
  });
}

async function getAvatarMetadata(user) {
  const filePath = path.join(avatarDirectory, user.avatarFile);
  const extension = path.extname(user.avatarFile).slice(1).toLowerCase();
  const expectedMimeType = avatarMimeTypes[extension];
  const metadata = await getImageMetadata(filePath);
  if (metadata.mimeType !== expectedMimeType || metadata.byteSize > 5 * 1024 * 1024) {
    throw new Error(`El avatar de ${user.displayName} no cumple las restricciones de Storage.`);
  }
  return { ...metadata, filePath, extension };
}

function avatarAssetId(label) {
  return stableId(`avatar:${label}`);
}

function avatarObjectPath(label, playerId, extension) {
  return `avatars/${playerId}/${avatarAssetId(label)}.${extension}`;
}

function challengeId(slug) {
  const labels = {
    "spain-survival-definition": "challenge-definition:spain-survival",
    "pyramid-abrahamic-definition": "challenge-definition:bible-pyramid",
    "steel-ball-run": "challenge-definition:steel-ball-run",
  };
  return stableId(labels[slug]);
}

function challengeVersionId(slug) {
  const labels = {
    "spain-survival-definition": "challenge-version:spain-survival-v1",
    "pyramid-abrahamic-definition": "challenge-version:bible-pyramid-v1",
    "steel-ball-run": "challenge-version:steel-ball-run-v1",
  };
  return stableId(labels[slug]);
}

function publicationId(slug) {
  return stableId(`publication:${slug}`);
}

function assetReference(key, alt, spainAssets, fit = "contain") {
  const definition = questionAssetDefinitions.find((asset) => asset.key === key);
  const prepared = spainAssets[key];
  return {
    assetId: prepared?.assetId ?? stableId(definition.label),
    alt,
    width: prepared?.metadata.width ?? definition.width,
    height: prepared?.metadata.height ?? definition.height,
    fit,
  };
}

function persistedQuestion(mockQuestion, points, spainAssets, expectedSlug) {
  if (!mockQuestion) {
    throw new Error(`No existe la pregunta mock "${expectedSlug}" referenciada por Tabarnia.`);
  }
  const { publicPayload: mockPublic, privatePayload } = mockQuestion;
  const source = mockPublic.payload ?? {};
  const solution = privatePayload.solution.payload ?? {};
  const explanation = privatePayload.solution.explanation;
  const publicPayload = {
    category: mockPublic.category,
    tags: mockPublic.tags,
    question: mockPublic.prompt,
  };
  let solutionPayload = { ...solution, explanation };
  let payloadSchemaVersion = 1;

  switch (mockQuestion.type) {
    case "multiple-choice":
      Object.assign(publicPayload, {
        options: source.options,
        media: source.media ?? null,
        promptVisual: source.promptVisual ?? null,
      });
      break;
    case "true-false":
      break;
    case "progressive-clues":
      Object.assign(publicPayload, {
        clues: privatePayload.reveals.map((reveal) => reveal.clue),
        cluePenalty: source.cluePenalty,
      });
      break;
    case "matching":
    case "ordering":
    case "classification":
    case "word-search":
    case "word-hashtag":
      Object.assign(publicPayload, source);
      if (mockQuestion.type === "word-search") {
        solutionPayload = {
          positionsByTargetId: solution.positionsByTargetId,
          explanation,
        };
      }
      break;
    case "estimation":
      Object.assign(publicPayload, source);
      payloadSchemaVersion = 2;
      break;
    case "heat-map":
      Object.assign(publicPayload, {
        surface: assetReference("canaryMap", source.surface.alt, spainAssets, source.surface.fit),
        targetLabel: source.targetLabel,
      });
      payloadSchemaVersion = 2;
      break;
    case "progressive-image": {
      const assetKey = mockQuestion.slug === "spain-survival-art-matching" ? "meninas" : "sagrada";
      Object.assign(publicPayload, {
        surface: assetReference(assetKey, source.surface.alt, spainAssets, source.surface.fit),
        revealDurationMs: source.revealDurationMs * 1000,
        answerLabel: source.answerLabel ?? null,
        answerPlaceholder: source.answerPlaceholder ?? null,
      });
      payloadSchemaVersion = 2;
      break;
    }
    case "mini-wordle":
      Object.assign(publicPayload, source);
      break;
    default:
      throw new Error(`Formato mock no soportado en Tabarnia: ${mockQuestion.type}`);
  }

  return {
    slug: mockQuestion.slug,
    type: mockQuestion.type,
    payloadSchemaVersion,
    timeLimitMs: mockPublic.timeLimitMs,
    points,
    publicPayload,
    solutionPayload,
  };
}

function tabarniaChallenges() {
  const spanish = TABARNIA_MOCK_CONTENT.challenges.find(
    (challenge) => challenge.slug === "spain-survival-definition",
  );
  const bible = TABARNIA_MOCK_CONTENT.challenges.find(
    (challenge) => challenge.slug === "pyramid-abrahamic-definition",
  );
  return [
    {
      ...bible,
      definitionSlug: "tabarnia-piramide-biblia",
      id: challengeId(bible.slug),
      versionId: challengeVersionId(bible.slug),
      modeConfig: {},
      items: bible.items.map((item) => ({ ...item, modeConfig: item.modeConfig })),
    },
    {
      slug: "steel-ball-run",
      definitionSlug: "tabarnia-flash-01",
      id: challengeId("steel-ball-run"),
      versionId: challengeVersionId("steel-ball-run"),
      title: "Steel Ball Run",
      subtitle: "Carrera, ingenio y reflejos",
      description: "Dieciséis retos rápidos para la primera temporada de Tabarnia.",
      mode: "flash",
      modeConfig: {},
      items: SBR_QUESTIONS.map((item) => ({ ...item, questionSlug: item.slug, modeConfig: {} })),
    },
    {
      ...spanish,
      definitionSlug: "tabarnia-supervivencia-espana",
      id: challengeId(spanish.slug),
      versionId: challengeVersionId(spanish.slug),
      modeConfig: { lives: 3 },
      items: spanish.items.map((item) => ({ ...item, modeConfig: {} })),
    },
  ];
}

export function buildTabarniaDomainSql({
  accounts,
  sbrAssetMetadata,
  spainAssets = {},
  avatarMetadata,
}) {
  const xesmona = accounts.xesmona.playerId;
  const roomId = stableId("room:tabarnia");
  const seasonId = stableId("season:tabarnia-alpha");
  const challenges = tabarniaChallenges();
  const items = [];
  const spainItems = challenges.find((challenge) => challenge.slug === "spain-survival-definition").items;
  const bibleItems = challenges.find((challenge) => challenge.slug === "pyramid-abrahamic-definition").items;
  const mockQuestions = new Map(
    TABARNIA_MOCK_CONTENT.questions.map((question) => [question.slug, question]),
  );
  const questions = [
    ...spainItems.map((item) =>
      persistedQuestion(
        mockQuestions.get(item.questionSlug),
        item.points,
        spainAssets,
        item.questionSlug,
      ),
    ),
    ...bibleItems.map((item) =>
      persistedQuestion(
        mockQuestions.get(item.questionSlug),
        item.points,
        spainAssets,
        item.questionSlug,
      ),
    ),
    ...SBR_QUESTIONS.map((item) => ({
      ...item,
      publicPayload: JSON.parse(
        JSON.stringify(item.publicPayload).replaceAll(
          "__SBR_ASSET_ID__",
          stableId("question-asset:tabarnia-sbr-grand-canyon-heat-map"),
        ),
      ),
    })),
  ];
  for (const challenge of challenges) {
    challenge.items.forEach((item, index) => {
      items.push({ item, challenge, index });
    });
  }

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
  const challengeItemSql = items
    .map(({ item, challenge, index }) => {
      const config = item.modeConfig ?? {};
      return `(${sqlString(stableId(`challenge-item:${item.questionSlug}`))}, ${sqlString(challenge.versionId)}, ${sqlString(stableId(`question-version:${item.questionSlug}`))}, ${index + 1}, ${item.points}, 1, ${sqlString(JSON.stringify(config))})`;
    })
    .join(",\n");
  const publishedQuestionIds = questions
    .map((item) => sqlString(stableId(`question-version:${item.slug}`)))
    .join(", ");
  const memberships = playerLabels
    .map(
      (label) =>
        `(${sqlString(roomId)}, ${sqlString(accounts[label].playerId)}, ${sqlString(label === "ches" ? "owner" : "member")}, 'active', now())`,
    )
    .join(",\n");
  const avatarAssets = TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => ({
    label: user.label,
    playerId: accounts[user.label].playerId,
    assetId: avatarAssetId(user.label),
    objectPath: avatarObjectPath(
      user.label,
      accounts[user.label].playerId,
      avatarMetadata[user.label].extension,
    ),
    metadata: avatarMetadata[user.label],
  }));
  const avatarMediaSql = avatarAssets
    .map(
      (avatar) =>
        `(${sqlString(avatar.assetId)}, 'avatars', ${sqlString(avatar.objectPath)}, 'avatar', 'ready', ${sqlString(avatar.playerId)}, ${sqlString(xesmona)}, ${sqlString(avatar.metadata.mimeType)}, ${avatar.metadata.byteSize}, ${avatar.metadata.width}, ${avatar.metadata.height}, ${sqlString(avatar.metadata.sha256)})`,
    )
    .join(",\n");
  const avatarPlayerUpdates = avatarAssets
    .map(
      (avatar) =>
        `update public.players set avatar_path = ${sqlString(avatar.objectPath)} where id = ${sqlString(avatar.playerId)};`,
    )
    .join("\n");
  const mediaAssets = [
    {
      assetId: stableId("question-asset:tabarnia-sbr-grand-canyon-heat-map"),
      objectPath: `question-assets/${stableId("question-asset:tabarnia-sbr-grand-canyon-heat-map")}.png`,
      metadata: sbrAssetMetadata,
    },
    ...Object.values(spainAssets).map((asset) => ({
      assetId: asset.assetId,
      objectPath: asset.objectPath,
      metadata: asset.metadata,
    })),
  ];
  const questionMediaSql = mediaAssets
    .map(
      (asset) =>
        `(${sqlString(asset.assetId)}, 'question-assets', ${sqlString(asset.objectPath)}, 'question-asset', 'ready', ${sqlString(xesmona)}, ${sqlString(asset.metadata.mimeType)}, ${asset.metadata.byteSize}, ${asset.metadata.width}, ${asset.metadata.height}, ${sqlString(asset.metadata.sha256)})`,
    )
    .join(",\n");
  const challengeDefinitionSql = challenges
    .map(
      (challenge) =>
        `(${sqlString(challenge.id)}, ${sqlString(challenge.definitionSlug)}, ${sqlString(xesmona)})`,
    )
    .join(",\n");
  const challengeVersionSql = challenges
    .map(
      (challenge) =>
        `(${sqlString(challenge.versionId)}, ${sqlString(challenge.id)}, 1, 1, 'draft', ${sqlString(challenge.mode)}, ${sqlString(challenge.title)}, ${sqlString(challenge.subtitle)}, ${sqlString(challenge.description)}, 100, ${sqlString(JSON.stringify(challenge.modeConfig))}, ${sqlString(xesmona)}, null)`,
    )
    .join(",\n");
  const scheduledSql = challenges
    .map((challenge, index) => {
      const start = index === 0 ? "now()" : `now() + interval '${index * 24} hours'`;
      const end = `now() + interval '${(index + 1) * 24} hours'`;
      const status = index === 0 ? "open" : "scheduled";
      return `(${sqlString(publicationId(challenge.slug))}, ${sqlString(seasonId)}, ${sqlString(challenge.versionId)}, ${index + 1}, '${status}', ${start}, ${end})`;
    })
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
${questionMediaSql};

insert into private.media_assets
  (id, bucket_id, object_path, kind, status, owner_player_id, created_by_player_id,
   mime_type, byte_size, width, height, sha256)
values
${avatarMediaSql};

${avatarPlayerUpdates}

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
values
${challengeDefinitionSql};

insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values
${challengeVersionSql};

insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
${challengeItemSql};

update private.challenge_versions
set status = 'published', published_at = now()
where id in (${challenges.map((challenge) => sqlString(challenge.versionId)).join(", ")});

insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values
${scheduledSql};

set constraints all immediate;
commit;
`;
}

export function tabarniaManifest(accounts, avatarMetadata) {
  const avatars = TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => ({
    label: user.label,
    sourceFile: user.avatarFile,
    assetId: avatarAssetId(user.label),
    objectPath: avatarObjectPath(
      user.label,
      accounts[user.label].playerId,
      avatarMetadata[user.label].extension,
    ),
  }));
  return {
    room: { id: stableId("room:tabarnia"), slug: "tabarnia" },
    seasonId: stableId("season:tabarnia-alpha"),
    challengeId: challengeId("pyramid-abrahamic-definition"),
    challengeVersionId: challengeVersionId("pyramid-abrahamic-definition"),
    publicationId: publicationId("pyramid-abrahamic-definition"),
    publications: tabarniaChallenges().map((challenge, index) => ({
      id: publicationId(challenge.slug),
      number: index + 1,
      slug: challenge.slug,
      title: challenge.title,
      mode: challenge.mode,
      challengeId: challenge.id,
      challengeVersionId: challenge.versionId,
      questionCount: challenge.items.length,
      pointsTotal: challenge.items.reduce((total, item) => total + item.points, 0),
      opensAfterHours: index * 24,
      durationHours: 24,
      status: index === 0 ? "open" : "scheduled",
    })),
    questionAssets: questionAssetDefinitions.map((asset) => ({
      id: stableId(asset.label),
      bucket: "question-assets",
      objectPath: `question-assets/${stableId(asset.label)}.${path.extname(asset.fileName).slice(1)}`,
      mimeType: asset.mimeType,
    })),
    asset: {
      id: stableId("question-asset:tabarnia-sbr-grand-canyon-heat-map"),
      bucket: "question-assets",
      objectPath: `question-assets/${stableId("question-asset:tabarnia-sbr-grand-canyon-heat-map")}.png`,
    },
    avatars,
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
  const readAssetMetadata = dependencies.getMapMetadata ?? getSbrMapMetadata;
  const readAvatarMetadata = dependencies.getAvatarMetadata ?? getAvatarMetadata;
  const loadDictionary = dependencies.loadMiniWordleDictionary ?? loadMiniWordleDictionary;
  const prepareAssets = dependencies.prepareSpainAssets ?? prepareSpainAssets;

  const config = await loadConfig({ requireServiceRole: true });
  assertLocalTabarniaUrl(config.url);
  await reset();
  await loadDictionary({ runSql });

  const accounts = await createAccounts(TABARNIA_USERS, config);
  const avatarMetadata = Object.fromEntries(
    await Promise.all(
      TABARNIA_USERS.filter((user) => user.avatarFile).map(async (user) => [
        user.label,
        await readAvatarMetadata(user),
      ]),
    ),
  );
  const seededStorageObjects = [];
  const preparedAssets = await prepareAssets();

  try {
    const sbrAssetMetadata = await readAssetMetadata();
    const storageObjects = [
      {
        bucket: "question-assets",
        objectPath: `question-assets/${stableId("question-asset:tabarnia-sbr-grand-canyon-heat-map")}.png`,
        filePath: sbrMapPath,
        contentType: "image/png",
      },
      ...Object.values(preparedAssets.assets).map((asset) => ({
        bucket: "question-assets",
        objectPath: asset.objectPath,
        filePath: asset.filePath,
        contentType: asset.metadata.mimeType,
      })),
      ...TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => ({
        bucket: "avatars",
        objectPath: avatarObjectPath(
          user.label,
          accounts[user.label].playerId,
          avatarMetadata[user.label].extension,
        ),
        filePath: avatarMetadata[user.label].filePath,
        contentType: avatarMetadata[user.label].mimeType,
      })),
    ];
    for (const storageObject of storageObjects) {
      seededStorageObjects.push(storageObject);
      await uploadAsset(config, { ...storageObject, upsert: true });
    }
    await runSql(
      buildTabarniaDomainSql({
        accounts,
        sbrAssetMetadata,
        spainAssets: preparedAssets.assets,
        avatarMetadata,
      }),
      config.dbContainer,
    );

    const output = tabarniaManifest(accounts, avatarMetadata);
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
    await Promise.all(
      seededStorageObjects.map((storageObject) =>
        Promise.resolve(removeAsset(config, storageObject)).catch(() => undefined),
      ),
    );
    throw error;
  } finally {
    await preparedAssets.cleanup();
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
