import { pathToFileURL } from "node:url";
import { BETA_VIP_ALPHABET } from "./fixtures/scenarios/betavip-alphabet.mjs";
import {
  createAuthAccounts,
  deterministicUuid,
  dockerSql,
  localSupabaseConfig,
  readFixture,
  sqlString,
  writeFixture,
} from "./support/supabase-local.mjs";
import { setupTabarniaDataset } from "./seed-tabarnia.mjs";

const namespace = "the-flash-game:betavip";
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
  const alphabet = {
    id: stableId("publication:beta-vip-la-vuelta-al-mundo"),
    number: 1,
    slug: BETA_VIP_ALPHABET.slug,
    title: BETA_VIP_ALPHABET.title,
    mode: "alphabet",
    challengeId: stableId(`challenge:${BETA_VIP_ALPHABET.definitionSlug}`),
    challengeVersionId: stableId(`challenge-version:${BETA_VIP_ALPHABET.definitionSlug}-v1`),
    questionCount: alphabetItems.length,
    pointsTotal: alphabetItems.reduce((total, item) => total + item.points, 0),
    opensAfterHours: 0,
    durationHours: 24,
    status: "open",
  };
  const steelPublication = {
    id: stableId("publication:beta-vip-steel-ball-run"),
    number: 2,
    slug: steel.slug,
    title: steel.title,
    mode: steel.mode,
    challengeId: steel.challengeId,
    challengeVersionId: steel.challengeVersionId,
    questionCount: steel.questionCount,
    pointsTotal: steel.pointsTotal,
    opensAfterHours: 24,
    durationHours: 24,
    status: "scheduled",
  };
  return {
    room: { id: stableId("room:beta-vip"), slug: "beta-vip" },
    seasonId: stableId("season:beta-vip"),
    publicationId: alphabet.id,
    challengeId: alphabet.challengeId,
    challengeVersionId: alphabet.challengeVersionId,
    questionCount: alphabet.questionCount,
    pointsTotal: alphabet.pointsTotal,
    steelBallRunPublicationId: steelPublication.id,
    publications: [alphabet, steelPublication],
    tabarnia: {
      room: tabarniaFixture.data.room,
      seasonId: tabarniaFixture.data.seasonId,
      steelBallRunPublicationId: steel.id,
    },
  };
}

export function buildBetaVipDomainSql({ tabarniaFixture, accounts }) {
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
  const alphabet = data.publications[0];
  const steel = data.publications[1];
  const questionDefinitions = alphabetItems
    .map(
      (item) =>
        `(${sqlString(item.definitionId)}, ${sqlString(item.slug)}, ${sqlString(authorId)})`,
    )
    .join(",\n");
  const questionVersions = alphabetItems
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
  const questionSolutions = alphabetItems
    .map((item) => {
      const solutionPayload = {
        correctAnswer: item.correctAnswer,
        acceptedAnswers: item.acceptedAnswers,
        explanation: item.explanation,
      };
      return `(${sqlString(item.versionId)}, ${sqlString(JSON.stringify(solutionPayload))})`;
    })
    .join(",\n");
  const challengeItems = alphabetItems
    .map(
      (item, index) =>
        `(${sqlString(item.itemId)}, ${sqlString(alphabet.challengeVersionId)}, ${sqlString(item.versionId)}, ${index + 1}, ${item.points}, 1, ${sqlString(JSON.stringify({ letter: item.letter }))})`,
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
values (${sqlString(data.seasonId)}, ${sqlString(data.room.id)}, 'Temporada BetaVIP', 'active', now(), now() + interval '48 hours');

insert into private.question_definitions (id, slug, created_by_player_id)
values
${questionDefinitions};

insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type,
   time_limit_ms, public_payload, created_by_player_id)
values
${questionVersions};

insert into private.question_version_solutions (question_version_id, solution_payload)
values
${questionSolutions};

update private.question_versions
set status = 'published', published_at = now()
where id in (${alphabetItems.map((item) => sqlString(item.versionId)).join(", ")});

insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlString(alphabet.challengeId)}, ${sqlString(BETA_VIP_ALPHABET.definitionSlug)}, ${sqlString(authorId)});

insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, global_time_limit_ms, mode_config,
   created_by_player_id, published_at)
values
  (${sqlString(alphabet.challengeVersionId)}, ${sqlString(alphabet.challengeId)}, 1, 1, 'draft',
   'alphabet', ${sqlString(BETA_VIP_ALPHABET.title)}, ${sqlString(BETA_VIP_ALPHABET.subtitle)},
   ${sqlString(BETA_VIP_ALPHABET.description)}, 100, ${BETA_VIP_ALPHABET.globalTimeLimitMs}, '{}',
   ${sqlString(authorId)}, null);

insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
${challengeItems};

update private.challenge_versions
set status = 'published', published_at = now()
where id = ${sqlString(alphabet.challengeVersionId)};

insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values
  (${sqlString(alphabet.id)}, ${sqlString(data.seasonId)}, ${sqlString(alphabet.challengeVersionId)}, 1,
   'open', now(), now() + interval '24 hours'),
  (${sqlString(steel.id)}, ${sqlString(data.seasonId)}, ${sqlString(steel.challengeVersionId)}, 2,
   'scheduled', now() + interval '24 hours', now() + interval '48 hours');
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

  await seedTabarnia();
  const tabarniaFixture = await loadFixture("tabarnia");
  const config = await loadConfig({ requireServiceRole: true });
  const accounts = await createAccounts({ id: "betavip", users: newUsers }, config);
  await runSql(buildBetaVipDomainSql({ tabarniaFixture, accounts }), config.dbContainer);

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
