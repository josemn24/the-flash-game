const namespace = "the-flash-game:f08";

const domainIds = {
  room: "f08-room-main",
  season: "f08-season-main",
  challenge: "f08-challenge",
  challengeVersion: "f08-challenge-version",
  questionOne: "f08-question-one",
  questionTwo: "f08-question-two",
  questionThree: "f08-question-three",
  questionVersionOne: "f08-question-version-one",
  questionVersionTwo: "f08-question-version-two",
  questionVersionThree: "f08-question-version-three",
  challengeItemOne: "f08-challenge-item-one",
  challengeItemTwo: "f08-challenge-item-two",
  challengeItemThree: "f08-challenge-item-three",
  publication: "f08-publication",
};

export const scenario = {
  id: "f08",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador F08" },
    { label: "alice", displayName: "Alice F08" },
    { label: "bob", displayName: "Bob F08" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const multipleChoice = {
      category: "Cultura general",
      question: "¿Cuál es la capital de Portugal?",
      options: ["Lisboa", "Oporto", "Braga"],
    };
    const logicMatrix = {
      category: "Lógica visual",
      question: "¿Qué pieza completa la matriz?",
      pieces: [
        { id: "a", symbol: "A", label: "Pieza A" },
        { id: "b", symbol: "B", label: "Pieza B" },
        { id: "c", symbol: "C", label: "Pieza C" },
        { id: "d", symbol: "D", label: "Pieza D" },
      ],
      cells: ["a", "b", "c", "b", "c", "a", "c", "a", null],
      optionIds: ["d", "a", "b", "c"],
      showPieceLabels: false,
    };

    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(domainIds.room)}, 'f08-main', 'Sala competitiva F08', 'Flash mixto con Matrices lógicas');
insert into public.room_memberships(room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.alice.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada F08', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions(id, slug, created_by_player_id)
  values
    (${sqlUuid(domainIds.questionOne)}, 'f08-question-one', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionTwo)}, 'f08-question-two', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionThree)}, 'f08-question-three', ${sqlString(accounts.alice.playerId)});
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms,
   public_payload, created_by_player_id)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1,
    'multiple-choice', 15000, ${sqlString(JSON.stringify(multipleChoice))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1,
    'logic-matrix', 30000, ${sqlString(JSON.stringify(logicMatrix))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionThree)}, ${sqlUuid(domainIds.questionThree)}, 1, 1,
    'logic-matrix', 30000, ${sqlString(JSON.stringify(logicMatrix))}, ${sqlString(accounts.alice.playerId)});
insert into private.question_version_solutions(question_version_id, solution_payload)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(JSON.stringify({ correctAnswer: "Lisboa", explanation: "Lisboa es la capital de Portugal." }))}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(JSON.stringify({ correctOptionId: "d", explanation: "La pieza D completa el patrón." }))}),
  (${sqlUuid(domainIds.questionVersionThree)}, ${sqlString(JSON.stringify({ correctOptionId: "d", explanation: "La pieza D completa el patrón." }))});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (${sqlUuid(domainIds.challenge)}, 'f08-flash-logic-matrix', ${sqlString(accounts.alice.playerId)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash',
  'Flash F08 Matrices lógicas', 'Elección múltiple + Matrices lógicas',
  'Formato final server-side sin solución en el payload jugable.', 100, '{}',
  ${sqlString(accounts.alice.playerId)}, null);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (${sqlUuid(domainIds.challengeItemOne)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionOne)}, 1, 34, 1, '{}'),
  (${sqlUuid(domainIds.challengeItemTwo)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionTwo)}, 2, 33, 1, '{}'),
  (${sqlUuid(domainIds.challengeItemThree)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionThree)}, 3, 33, 1, '{}');
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
      room: { id: stableId(domainIds.room), slug: "f08-main" },
      publicationId: stableId(domainIds.publication),
      challengeId: stableId(domainIds.challenge),
      challengeVersionId: stableId(domainIds.challengeVersion),
      challengeItemIds: [
        stableId(domainIds.challengeItemOne),
        stableId(domainIds.challengeItemTwo),
        stableId(domainIds.challengeItemThree),
      ],
    };
  },
};

export default scenario;
