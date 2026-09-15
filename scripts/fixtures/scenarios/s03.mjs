const namespace = "the-flash-game:s03";

const domainIds = {
  room: "s03-room-main",
  season: "s03-season-main",
  challenge: "s03-challenge",
  challengeVersion: "s03-challenge-version",
  questionOne: "s03-question-one",
  questionTwo: "s03-question-two",
  questionVersionOne: "s03-question-version-one",
  questionVersionTwo: "s03-question-version-two",
  challengeItemOne: "s03-challenge-item-one",
  challengeItemTwo: "s03-challenge-item-two",
  publication: "s03-publication",
};

const publicQuestion = (id, prompt, options) => ({
  id,
  category: "Cultura general",
  tags: {
    domains: ["culture"],
    topics: ["general"],
    cognitiveSkills: ["memory"],
    formatSkills: ["recall"],
    lifeSkills: [],
  },
  question: prompt,
  options,
  media: null,
  promptVisual: null,
});

export const scenario = {
  id: "s03",
  namespace,
  users: [
    { label: "alice", displayName: "Alice" },
    { label: "bob", displayName: "Bob" },
    { label: "carol", displayName: "Carol" },
    { label: "dave", displayName: "Dave" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const alice = accounts.alice.playerId;
    const bob = accounts.bob.playerId;
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const questionOne = publicQuestion("s03-question-one", "¿Cuál es la capital de Portugal?", [
      "Lisboa",
      "Oporto",
      "Braga",
      "Coímbra",
    ]);
    const questionTwo = publicQuestion(
      "s03-question-two",
      "¿Qué planeta es conocido como el planeta rojo?",
      ["Venus", "Marte", "Júpiter", "Saturno"],
    );

    return `
begin;
set constraints all deferred;
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(domainIds.room)}, 's03-main', 'Sala competitiva S03', 'Flash persistido de dos preguntas');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(domainIds.room)}, ${sqlString(alice)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(bob)}, 'spectator', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.carol.playerId)}, 'member', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.dave.playerId)}, 'member', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada S03', 'active',
  ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(domainIds.questionOne)}, 's03-question-one', ${sqlString(alice)}),
  (${sqlUuid(domainIds.questionTwo)}, 's03-question-two', ${sqlString(alice)});
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms,
   public_payload, created_by_player_id)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 1,
    'multiple-choice', 15000, ${sqlString(JSON.stringify(questionOne))}, ${sqlString(alice)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 1,
    'multiple-choice', 15000, ${sqlString(JSON.stringify(questionTwo))}, ${sqlString(alice)});
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(JSON.stringify({ correctAnswer: "Lisboa", explanation: "Lisboa es la capital de Portugal." }))}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(JSON.stringify({ correctAnswer: "Marte", explanation: "Marte recibe el nombre de planeta rojo por el óxido de hierro de su superficie." }))});
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid(domainIds.challenge)}, 's03-flash-two-questions', ${sqlString(alice)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'flash',
  'Flash competitivo', 'Dos preguntas de 50 puntos', 'Completa el flash y conserva tu resultado.',
  100, '{}', ${sqlString(alice)}, null);
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
      room: { id: stableId(domainIds.room), slug: "s03-main" },
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
