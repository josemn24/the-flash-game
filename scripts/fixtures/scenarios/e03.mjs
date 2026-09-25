const namespace = "the-flash-game:e03";

const domainIds = {
  room: "e03-room-main",
  season: "e03-season-main",
  challenge: "e03-challenge",
  challengeVersion: "e03-challenge-version",
  questionOne: "e03-question-one",
  questionTwo: "e03-question-two",
  questionVersionOne: "e03-question-version-one",
  questionVersionTwo: "e03-question-version-two",
  challengeItemOne: "e03-challenge-item-one",
  challengeItemTwo: "e03-challenge-item-two",
  publication: "e03-publication",
};

const tags = {
  domains: ["history"],
  topics: ["europe"],
  cognitiveSkills: ["recall"],
  formatSkills: ["progressive-clues"],
  lifeSkills: [],
};

export const scenario = {
  id: "e03",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador E03" },
    { label: "alice", displayName: "Alice E03" },
    { label: "bob", displayName: "Bob E03" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const multipleChoice = {
      category: "Cultura general",
      tags,
      question: "¿Cuál es la capital de Portugal?",
      options: ["Lisboa", "Oporto", "Braga"],
      media: null,
      promptVisual: null,
    };
    const progressiveClues = {
      category: "Historia",
      tags,
      question: "Identifica el acontecimiento",
      clues: ["Ocurrió en Europa.", "Está relacionado con una caída de muro.", "Sucedió en 1989."],
      cluePenalty: 25,
    };

    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(domainIds.room)}, 'e03-main', 'Sala competitiva E03', 'Flash mixto con Progressive-clues');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.alice.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada E03', 'active',
  ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(domainIds.questionOne)}, 'e03-question-one', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionTwo)}, 'e03-question-two', ${sqlString(accounts.alice.playerId)});
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms,
   public_payload, created_by_player_id)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1,
    'multiple-choice', 15000, ${sqlString(JSON.stringify(multipleChoice))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1,
    'progressive-clues', 90000, ${sqlString(JSON.stringify(progressiveClues))}, ${sqlString(accounts.alice.playerId)});
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(
    JSON.stringify({
      correctAnswer: "Lisboa",
      explanation: "Lisboa es la capital de Portugal.",
    }),
  )}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(
    JSON.stringify({
      correctAnswer: "Caída del muro de Berlín",
      acceptedAnswers: ["caida del muro de berlin", "muro de berlin"],
      explanation: "La respuesta identifica el acontecimiento.",
    }),
  )});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid(domainIds.challenge)}, 'e03-flash-progressive-clues', ${sqlString(accounts.alice.playerId)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash',
  'Flash E03 Progressive-clues', 'Elección múltiple + pistas progresivas',
  'Formato con pistas privadas reveladas bajo demanda.', 100, '{}',
  ${sqlString(accounts.alice.playerId)}, null);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (${sqlUuid(domainIds.challengeItemOne)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionOne)}, 1, 50, 1, '{}'),
  (${sqlUuid(domainIds.challengeItemTwo)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionTwo)}, 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = ${sqlString(dateStart)}
where id = ${sqlUuid(domainIds.challengeVersion)};
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (${sqlUuid(domainIds.publication)}, ${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.challengeVersion)},
  1, 'open', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
set constraints all immediate;
commit;
`;
  },

  manifest({ stableId }) {
    return {
      room: { id: stableId(domainIds.room), slug: "e03-main" },
      publicationId: stableId(domainIds.publication),
      challengeId: stableId(domainIds.challenge),
      challengeVersionId: stableId(domainIds.challengeVersion),
      challengeItemIds: [
        stableId(domainIds.challengeItemOne),
        stableId(domainIds.challengeItemTwo),
      ],
    };
  },
};

export default scenario;
