const namespace = "the-flash-game:e04";

const domainIds = {
  room: "e04-room-main",
  season: "e04-season-main",
  challenge: "e04-challenge",
  challengeVersion: "e04-challenge-version",
  questionOne: "e04-question-one",
  questionTwo: "e04-question-two",
  questionVersionOne: "e04-question-version-one",
  questionVersionTwo: "e04-question-version-two",
  challengeItemOne: "e04-challenge-item-one",
  challengeItemTwo: "e04-challenge-item-two",
  publication: "e04-publication",
};

export const scenario = {
  id: "e04",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador E04" },
    { label: "alice", displayName: "Alice E04" },
    { label: "bob", displayName: "Bob E04" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const multipleChoice = {
      category: "Cultura general",
      question: "¿Cuál es la capital de Portugal?",
      options: ["Lisboa", "Oporto", "Braga"],
    };
    const matching = {
      category: "Cultura general",
      question: "Relaciona cada concepto",
      leftItems: [
        { id: "l1", label: "Uno" },
        { id: "l2", label: "Dos" },
        { id: "l3", label: "Tres" },
      ],
      rightItems: [
        { id: "r1", label: "Primero" },
        { id: "r2", label: "Segundo" },
        { id: "r3", label: "Tercero" },
      ],
    };
    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role) values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description) values (${sqlUuid(domainIds.room)}, 'e04-main', 'Sala competitiva E04', 'Flash mixto con Matching');
insert into public.room_memberships (room_id, player_id, role, status, joined_at) values
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.alice.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at) values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada E04', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id) values
  (${sqlUuid(domainIds.questionOne)}, 'e04-question-one', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionTwo)}, 'e04-question-two', ${sqlString(accounts.alice.playerId)});
insert into private.question_versions (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms, public_payload, created_by_player_id) values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1, 'multiple-choice', 15000, ${sqlString(JSON.stringify(multipleChoice))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1, 'matching', 90000, ${sqlString(JSON.stringify(matching))}, ${sqlString(accounts.alice.playerId)});
insert into private.question_version_solutions (question_version_id, solution_payload) values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(JSON.stringify({ correctAnswer: "Lisboa", explanation: "Portugal." }))}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(JSON.stringify({ matches: { l1: "r1", l2: "r2", l3: "r3" }, explanation: "Cada concepto tiene su equivalente." }))});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id) values (${sqlUuid(domainIds.challenge)}, 'e04-flash-matching', ${sqlString(accounts.alice.playerId)});
insert into private.challenge_versions (id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash', 'Flash E04 Matching', 'Elección múltiple + parejas', 'Formato de correspondencias server-side.', 100, '{}', ${sqlString(accounts.alice.playerId)}, null);
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
      room: { id: stableId(domainIds.room), slug: "e04-main" },
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
