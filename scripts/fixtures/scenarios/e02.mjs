const namespace = "the-flash-game:e02";

const domainIds = {
  room: "e02-room-main",
  season: "e02-season-main",
  challenge: "e02-challenge",
  challengeVersion: "e02-challenge-version",
  questionOne: "e02-question-one",
  questionTwo: "e02-question-two",
  questionVersionOne: "e02-question-version-one",
  questionVersionTwo: "e02-question-version-two",
  challengeItemOne: "e02-challenge-item-one",
  challengeItemTwo: "e02-challenge-item-two",
  publication: "e02-publication",
};

const tags = {
  domains: ["logic"],
  topics: ["puzzles"],
  cognitiveSkills: ["reasoning"],
  formatSkills: ["code-game"],
  lifeSkills: [],
};

export const scenario = {
  id: "e02",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador E02" },
    { label: "alice", displayName: "Alice E02" },
    { label: "bob", displayName: "Bob E02" },
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
    const logicCode = {
      category: "Lógica",
      tags,
      question: "Descubre el código",
      codeLength: 4,
      clues: [
        { code: "1203", hint: "El segundo dígito es el doble del primero." },
        { code: "0312", hint: "El último dígito coincide con el tercero." },
      ],
    };

    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(domainIds.room)}, 'e02-main', 'Sala competitiva E02', 'Flash mixto con Logic-code');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.alice.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada E02', 'active',
  ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(domainIds.questionOne)}, 'e02-question-one', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionTwo)}, 'e02-question-two', ${sqlString(accounts.alice.playerId)});
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms,
   public_payload, created_by_player_id)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1,
    'multiple-choice', 15000, ${sqlString(JSON.stringify(multipleChoice))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1,
    'logic-code', 90000, ${sqlString(JSON.stringify(logicCode))}, ${sqlString(accounts.alice.playerId)});
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
      correctAnswer: "0420",
      explanation: "La secuencia satisface las pistas.",
    }),
  )});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid(domainIds.challenge)}, 'e02-flash-logic-code', ${sqlString(accounts.alice.playerId)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash',
  'Flash E02 Logic-code', 'Elección múltiple + Logic-code',
  'Formato con eventos numéricos persistidos.', 100, '{}',
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
      room: { id: stableId(domainIds.room), slug: "e02-main" },
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
