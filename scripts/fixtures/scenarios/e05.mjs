const namespace = "the-flash-game:e05";

const domainIds = {
  room: "e05-room-main",
  season: "e05-season-main",
  challenge: "e05-challenge",
  challengeVersion: "e05-challenge-version",
  questionOne: "e05-question-one",
  questionTwo: "e05-question-two",
  questionVersionOne: "e05-question-version-one",
  questionVersionTwo: "e05-question-version-two",
  challengeItemOne: "e05-challenge-item-one",
  challengeItemTwo: "e05-challenge-item-two",
  publication: "e05-publication",
};

const regions = [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3];
const solution = [2, 9, 10, 18, 21];

export const scenario = {
  id: "e05",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador E05" },
    { label: "alice", displayName: "Alice E05" },
    { label: "bob", displayName: "Bob E05" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const multipleChoice = {
      category: "Cultura general",
      question: "¿Cuál es la capital de Portugal?",
      options: ["Lisboa", "Oporto", "Braga"],
    };
    const queens = {
      category: "Lógica",
      question: "Coloca las cinco coronas.",
      grid: { rows: 5, columns: 5 },
      regions,
      prefilledQueens: [2],
    };
    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role) values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description) values (${sqlUuid(domainIds.room)}, 'e05-main', 'Sala competitiva E05', 'Flash mixto con Queens');
insert into public.room_memberships (room_id, player_id, role, status, joined_at) values
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.alice.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at) values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada E05', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id) values
  (${sqlUuid(domainIds.questionOne)}, 'e05-question-one', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionTwo)}, 'e05-question-two', ${sqlString(accounts.alice.playerId)});
insert into private.question_versions (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms, public_payload, created_by_player_id) values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1, 'multiple-choice', 15000, ${sqlString(JSON.stringify(multipleChoice))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1, 'queens', 90000, ${sqlString(JSON.stringify(queens))}, ${sqlString(accounts.alice.playerId)});
insert into private.question_version_solutions (question_version_id, solution_payload) values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(JSON.stringify({ correctAnswer: "Lisboa", explanation: "Portugal." }))}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(JSON.stringify({ solution, explanation: "Una corona por fila, columna y región." }))});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id) values (${sqlUuid(domainIds.challenge)}, 'e05-flash-queens', ${sqlString(accounts.alice.playerId)});
insert into private.challenge_versions (id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash', 'Flash E05 Queens', 'Elección múltiple + Queens', 'Tablero server-side con eventos persistidos.', 100, '{}', ${sqlString(accounts.alice.playerId)}, null);
insert into private.challenge_items (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config) values
  (${sqlUuid(domainIds.challengeItemOne)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionOne)}, 1, 50, 1, '{}'),
  (${sqlUuid(domainIds.challengeItemTwo)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionTwo)}, 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = ${sqlString(dateStart)}
where id = ${sqlUuid(domainIds.challengeVersion)};
insert into public.scheduled_challenges (id, season_id, challenge_version_id, number, status, opens_at, closes_at) values
  (${sqlUuid(domainIds.publication)}, ${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.challengeVersion)}, 1, 'open', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
set constraints all immediate;
commit;
`;
  },

  manifest({ stableId }) {
    return {
      room: { id: stableId(domainIds.room), slug: "e05-main" },
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
