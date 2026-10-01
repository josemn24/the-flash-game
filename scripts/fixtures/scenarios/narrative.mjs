const namespace = "the-flash-game:narrative";

const domainIds = {
  room: "narrative-room-main",
  season: "narrative-season-main",
  challenge: "narrative-challenge",
  challengeVersion: "narrative-challenge-version",
  questionOne: "narrative-question-one",
  questionTwo: "narrative-question-two",
  questionVersionOne: "narrative-question-version-one",
  questionVersionTwo: "narrative-question-version-two",
  challengeItemOne: "narrative-challenge-item-one",
  challengeItemTwo: "narrative-challenge-item-two",
  publication: "narrative-publication",
};

const publicQuestion = (id, prompt, options) => ({
  id,
  category: "Exploración antártica",
  tags: {
    domains: ["science"],
    topics: ["antarctica"],
    cognitiveSkills: ["recall"],
    formatSkills: ["multiple-choice"],
    lifeSkills: [],
  },
  question: prompt,
  options,
  media: null,
  promptVisual: null,
});

const narrativeScene = (id, title, text) => ({
  id,
  presentation: "text-led",
  title,
  blocks: [{ type: "narration", text }],
});

export const scenario = {
  id: "narrative",
  namespace,
  users: [
    { label: "alice", displayName: "Alice" },
    { label: "bob", displayName: "Bob" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const alice = accounts.alice.playerId;
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const questionOne = publicQuestion(
      "narrative-question-one",
      "¿Qué continente rodea el Polo Sur?",
      ["África", "Antártida", "Europa", "Oceanía"],
    );
    const questionTwo = publicQuestion(
      "narrative-question-two",
      "¿Qué instrumento registra la temperatura?",
      ["Termómetro", "Barómetro", "Anemómetro", "Sismógrafo"],
    );
    const modeConfig = {
      prologue: narrativeScene(
        "narrative-prologue",
        "La señal bajo el hielo",
        "La expedición despierta una baliza enterrada bajo la nieve.",
      ),
      beats: [
        {
          id: "narrative-beat-one",
          title: "La primera lectura",
          steps: [
            {
              type: "scene",
              scene: narrativeScene(
                "narrative-scene-one",
                "Una coordenada imposible",
                "El cuaderno de campo apunta hacia el continente blanco.",
              ),
            },
            {
              type: "question",
              questionSlug: "narrative-question-one",
              reactions: {
                correct: [{ type: "emphasis", text: "La baliza responde." }],
                incorrect: [{ type: "emphasis", text: "La señal se debilita." }],
                timeout: [{ type: "emphasis", text: "La ventana de lectura se cierra." }],
              },
            },
            {
              type: "scene",
              scene: narrativeScene(
                "narrative-scene-two",
                "El aire cambia",
                "La estación registra una variación brusca en el hielo.",
              ),
            },
            {
              type: "question",
              questionSlug: "narrative-question-two",
              reactions: {
                correct: [{ type: "emphasis", text: "El registro queda validado." }],
                incorrect: [{ type: "emphasis", text: "El registro necesita revisión." }],
                timeout: [{ type: "emphasis", text: "El dato se pierde en la tormenta." }],
              },
            },
          ],
        },
      ],
    };

    return `
begin;
set constraints all deferred;
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(domainIds.room)}, 'narrative-main', 'Sala Narrative', 'Narrativa competitiva persistida');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(domainIds.room)}, ${sqlString(alice)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid(domainIds.room)}, ${sqlString(accounts.bob.playerId)}, 'member', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(domainIds.season)}, ${sqlUuid(domainIds.room)}, 'Temporada Narrative', 'active',
  ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(domainIds.questionOne)}, 'narrative-question-one', ${sqlString(alice)}),
  (${sqlUuid(domainIds.questionTwo)}, 'narrative-question-two', ${sqlString(alice)});
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
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlString(
    JSON.stringify({
      correctAnswer: "Antártida",
      explanation: "NARRATIVE_PRIVATE_ONE: La Antártida rodea el Polo Sur.",
    }),
  )}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlString(
    JSON.stringify({
      correctAnswer: "Termómetro",
      explanation: "NARRATIVE_PRIVATE_TWO: El termómetro registra la temperatura.",
    }),
  )});
update private.question_versions
set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid(domainIds.challenge)}, 'narrative-persisted', ${sqlString(alice)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 1, 'draft', 'narrative',
  'La señal bajo el hielo', 'Dos decisiones para completar la expedición',
  'Un recorrido narrativo con escenas y preguntas persistidas.', 100,
  ${sqlString(JSON.stringify(modeConfig))}, ${sqlString(alice)}, null);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (${sqlUuid(domainIds.challengeItemOne)}, ${sqlUuid(domainIds.challengeVersion)},
    ${sqlUuid(domainIds.questionVersionOne)}, 1, 50, 1,
    ${sqlString(JSON.stringify({ questionSlug: "narrative-question-one" }))}),
  (${sqlUuid(domainIds.challengeItemTwo)}, ${sqlUuid(domainIds.challengeVersion)},
    ${sqlUuid(domainIds.questionVersionTwo)}, 2, 50, 1,
    ${sqlString(JSON.stringify({ questionSlug: "narrative-question-two" }))});
update private.challenge_versions set status = 'published', published_at = ${sqlString(dateStart)}
where id = ${sqlUuid(domainIds.challengeVersion)};
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (${sqlUuid(domainIds.publication)}, ${sqlUuid(domainIds.season)},
  ${sqlUuid(domainIds.challengeVersion)}, 1, 'open', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
set constraints all immediate;
commit;
`;
  },

  manifest({ stableId }) {
    return {
      room: { id: stableId(domainIds.room), slug: "narrative-main" },
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
