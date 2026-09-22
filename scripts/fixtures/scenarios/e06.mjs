const namespace = "the-flash-game:e06";

const domainIds = {
  room: "e06-room-main",
  season: "e06-season-main",
  challenge: "e06-challenge",
  challengeVersion: "e06-challenge-version",
  questionOne: "e06-question-one",
  questionTwo: "e06-question-two",
  questionVersionOne: "e06-question-version-one",
  questionVersionTwo: "e06-question-version-two",
  challengeItemOne: "e06-challenge-item-one",
  challengeItemTwo: "e06-challenge-item-two",
  publication: "e06-publication",
};

export const scenario = {
  id: "e06",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador E06" },
    { label: "alice", displayName: "Alice E06" },
    { label: "bob", displayName: "Bob E06" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const multipleChoice = {
      category: "Cultura general",
      question: "¿Cuál es la capital de Portugal?",
      options: ["Lisboa", "Oporto", "Braga"],
    };
    const wordSearch = {
      category: "Lengua",
      tags: { domains: ["language"], topics: ["vocabulary"] },
      question: "Encuentra CASA y ÑANDÚ",
      grid: { rows: 6, columns: 6 },
      letters: [
        "C", "A", "S", "A", "X", "X",
        "Ñ", "A", "N", "D", "Ú", "Z",
        "B", "Q", "E", "R", "T", "Y",
        "G", "H", "I", "J", "K", "L",
        "M", "O", "P", "V", "W", "F",
        "Á", "É", "Í", "Ó", "Ú", "Ü",
      ],
      targets: [
        { id: "casa", word: "CASA" },
        { id: "nandu", word: "ÑANDÚ" },
      ],
    };
    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(domainIds.room)}, 'e06-main', 'Sala competitiva E06', 'Flash mixto con Sopa de letras');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.alice.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada E06', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(domainIds.questionOne)}, 'e06-question-one', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionTwo)}, 'e06-question-two', ${sqlString(accounts.alice.playerId)});
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms,
   public_payload, created_by_player_id)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1,
    'multiple-choice', 15000, ${sqlString(JSON.stringify(multipleChoice))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1,
    'word-search', 90000, ${sqlString(JSON.stringify(wordSearch))}, ${sqlString(accounts.alice.playerId)});
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(JSON.stringify({
    correctAnswer: "Lisboa",
    explanation: "Lisboa es la capital de Portugal.",
  }))}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(JSON.stringify({
    positionsByTargetId: {
      casa: { startCell: 0, endCell: 3 },
      nandu: { startCell: 6, endCell: 10 },
    },
    explanation: "Las palabras se encuentran en la primera y segunda fila.",
  }))});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid(domainIds.challenge)}, 'e06-flash-word-search', ${sqlString(accounts.alice.playerId)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash',
  'Flash E06 Word-search', 'Elección múltiple + Sopa de letras',
  'Selecciones server-side con recuperación e idempotencia.', 100, '{}',
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
      room: { id: stableId(domainIds.room), slug: "e06-main" },
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
