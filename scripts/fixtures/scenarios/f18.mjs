const namespace = "the-flash-game:f18";

const domainIds = {
  room: "f18-room-main",
  season: "f18-season-main",
  challenge: "f18-challenge",
  challengeVersion: "f18-challenge-version",
  questionOne: "f18-question-one",
  questionTwo: "f18-question-two",
  questionVersionOne: "f18-question-version-one",
  questionVersionTwo: "f18-question-version-two",
  challengeItemOne: "f18-challenge-item-one",
  challengeItemTwo: "f18-challenge-item-two",
  publication: "f18-publication",
};

export const scenario = {
  id: "f18",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador F18" },
    { label: "alice", displayName: "Alice F18" },
    { label: "charlie", displayName: "Charlie F18" },
    { label: "bob", displayName: "Bob F18" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const multipleChoice = {
      category: "Cultura general",
      question: "¿Cuál es la capital de Portugal?",
      options: ["Lisboa", "Oporto", "Braga"],
    };
    const escape = {
      category: "Lógica espacial",
      question: "Mueve los bloques para liberar la pieza amarilla por la salida.",
      grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
      initialBlocks: [
        { id: "target", kind: "target", orientation: "horizontal", row: 2, column: 0, length: 2 },
        { id: "a", kind: "obstacle", orientation: "vertical", row: 1, column: 2, length: 2 },
        { id: "b", kind: "obstacle", orientation: "vertical", row: 0, column: 4, length: 3 },
        { id: "c", kind: "obstacle", orientation: "horizontal", row: 0, column: 1, length: 2 },
        { id: "d", kind: "obstacle", orientation: "horizontal", row: 4, column: 1, length: 2 },
      ],
      instruction: "Despeja la fila del bloque amarillo.",
      boardLabel: "Tablero Escape F18",
    };
    const referenceSolution = [
      { blockId: "c", from: 1, to: 0 },
      { blockId: "a", from: 1, to: 0 },
      { blockId: "b", from: 0, to: 3 },
      { blockId: "target", from: 0, to: 4 },
    ];

    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(domainIds.room)}, 'f18-main', 'Sala competitiva F18', 'Flash mixto con Escape');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.alice.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.charlie.playerId)}, 'member', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada F18', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(domainIds.questionOne)}, 'f18-question-one', ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionTwo)}, 'f18-question-two', ${sqlString(accounts.alice.playerId)});
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms,
   public_payload, created_by_player_id)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1,
    'multiple-choice', 15000, ${sqlString(JSON.stringify(multipleChoice))}, ${sqlString(accounts.alice.playerId)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1,
    'escape', 30000, ${sqlString(JSON.stringify(escape))}, ${sqlString(accounts.alice.playerId)});
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(JSON.stringify({
    correctAnswer: "Lisboa",
    explanation: "Lisboa es la capital de Portugal.",
  }))}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(JSON.stringify({
    referenceSolution,
    optimalMoves: 4,
    explanation: "La referencia despeja los tres obstáculos antes de mover el objetivo.",
  }))});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)}
where status = 'draft';
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid(domainIds.challenge)}, 'f18-flash-escape', ${sqlString(accounts.alice.playerId)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash',
  'Flash F18 Escape', 'Elección múltiple + Escape',
  'Movimientos locales con evaluación server-side y solución privada.', 100, '{}',
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
      room: { id: stableId(domainIds.room), slug: "f18-main" },
      publicationId: stableId(domainIds.publication),
      challengeId: stableId(domainIds.challenge),
      challengeVersionId: stableId(domainIds.challengeVersion),
      challengeItemIds: [stableId(domainIds.challengeItemOne), stableId(domainIds.challengeItemTwo)],
    };
  },
};

export default scenario;
