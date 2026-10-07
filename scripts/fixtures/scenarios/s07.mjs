import { additionalHistorySql } from "./s07-history-modes.mjs";

const namespace = "the-flash-game:s07";

const ids = {
  room: "s07-room-main",
  season: "s07-season-main",
  challenge: "s07-challenge",
  challengeVersion: "s07-challenge-version",
  questionOne: "s07-question-one",
  questionTwo: "s07-question-two",
  questionVersionOne: "s07-question-version-one",
  questionVersionTwo: "s07-question-version-two",
  challengeItemOne: "s07-challenge-item-one",
  challengeItemTwo: "s07-challenge-item-two",
  survivalChallenge: "s07-survival-challenge",
  survivalChallengeVersion: "s07-survival-challenge-version",
  survivalItemOne: "s07-survival-item-one",
  survivalItemTwo: "s07-survival-item-two",
  pyramidChallenge: "s07-pyramid-challenge",
  pyramidChallengeVersion: "s07-pyramid-challenge-version",
  publicationCompleted: "s07-publication-completed",
  publicationAbandoned: "s07-publication-abandoned",
  publicationEmpty: "s07-publication-empty",
  publicationInProgress: "s07-publication-in-progress",
  publicationCancelled: "s07-publication-cancelled",
  publicationArchived: "s07-publication-archived",
  publicationSurvival: "s07-publication-survival",
  publicationPyramid: "s07-publication-pyramid",
  attemptAliceCompleted: "s07-attempt-alice-completed",
  attemptCarolCompleted: "s07-attempt-carol-completed",
  attemptDaveCompleted: "s07-attempt-dave-completed",
  attemptCarolAbandoned: "s07-attempt-carol-abandoned",
  attemptAliceInProgress: "s07-attempt-alice-in-progress",
  attemptDaveArchived: "s07-attempt-dave-archived",
  attemptSurvival: "s07-attempt-survival",
  attemptPyramid: "s07-attempt-pyramid",
};

const publicQuestion = (id, prompt, options) => ({
  category: "Cultura general",
  tags: {
    domains: ["culture"],
    topics: ["general"],
    cognitiveSkills: ["memory"],
    formatSkills: ["recall"],
    lifeSkills: [],
  },
  prompt,
  context: null,
  timeLimitMs: 15000,
  payload: { options, media: null, promptVisual: null },
});

export const scenario = {
  id: "s07",
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
    const carol = accounts.carol.playerId;
    const dave = accounts.dave.playerId;
    const start = "2025-01-01T00:00:00Z";
    const seasonEnd = "2999-01-01T00:00:00Z";
    const inProgressStarted = new Date().toISOString();
    const questionOne = publicQuestion("s07-question-one", "¿Cuál es la capital de Portugal?", [
      "Lisboa",
      "Oporto",
      "Braga",
      "Coímbra",
    ]);
    const questionTwo = publicQuestion(
      "s07-question-two",
      "¿Qué planeta es conocido como el planeta rojo?",
      ["Venus", "Marte", "Júpiter", "Saturno"],
    );
    const pub = (label) => sqlUuid(label);
    const attempt = (label) => sqlUuid(label);
    const itemOne = sqlUuid(ids.challengeItemOne);
    const itemTwo = sqlUuid(ids.challengeItemTwo);
    const version = sqlUuid(ids.challengeVersion);
    const survivalVersion = sqlUuid(ids.survivalChallengeVersion);
    const survivalItemOne = sqlUuid(ids.survivalItemOne);
    const survivalItemTwo = sqlUuid(ids.survivalItemTwo);
    const pyramidVersion = sqlUuid(ids.pyramidChallengeVersion);
    const pyramidItems = Array.from({ length: 7 }, (_, index) =>
      sqlUuid(`s07-pyramid-item-${index + 1}`),
    );
    const pyramidQuestionDefinitions = Array.from({ length: 5 }, (_, index) =>
      sqlUuid(`s07-pyramid-question-${index + 3}`),
    );
    const pyramidQuestionVersions = Array.from({ length: 5 }, (_, index) =>
      sqlUuid(`s07-pyramid-question-version-${index + 3}`),
    );
    const pyramidQuestions = Array.from({ length: 5 }, (_, index) =>
      publicQuestion(
        `s07-pyramid-question-${index + 3}`,
        `¿Cuál es la respuesta del nivel ${index + 3}?`,
        ["A", "B", "C", "D"],
      ),
    );
    const answer = (
      attemptId,
      itemId,
      playerId,
      status,
      value,
      points,
      presentedAt,
      answerVersion = version,
    ) => `
      with receipt as (
        insert into private.answer_receipts
          (id, attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
           presented_at, effective_submitted_at, time_used_ms, timed_out)
        values (gen_random_uuid(), ${attemptId}, ${itemId}, ${answerVersion}, ${sqlString(
          JSON.stringify(value),
        )}::jsonb, ${sqlString(presentedAt)}, ${sqlString(presentedAt)},
          ${sqlString(presentedAt)}, ${points === 50 ? 900 : 1100}, ${status === "timeout"})
        returning id
      )
      insert into private.attempt_answers
        (attempt_id, challenge_item_id, challenge_version_id, receipt_id, status, answer,
         result_details, points, presented_at, submitted_at, time_used_ms, idempotency_key)
      select ${attemptId}, ${itemId}, ${answerVersion}, receipt.id, ${sqlString(status)}, ${sqlString(
        JSON.stringify(value),
      )}::jsonb, '{}'::jsonb, ${points}, ${sqlString(presentedAt)},
        ${sqlString(presentedAt)}, ${points === 50 ? 900 : 1100},
        ${sqlString(`s07-answer-${attemptId}-${itemId}-${playerId}`)}
      from receipt;`;
    const completedAttempt = (
      attemptId,
      publicationId,
      playerId,
      score,
      startedAt,
      completedAt,
    ) => `
      insert into public.attempts
        (id, player_id, scheduled_challenge_id, challenge_version_id, attempt_number, kind,
         status, started_at, completed_at, score, client_state_schema_version, lock_version)
      values (${attemptId}, ${sqlString(playerId)}, ${publicationId}, ${version}, 1, 'competitive',
        'completed', ${sqlString(startedAt)}, ${sqlString(completedAt)}, ${score}, 1, 1);
      ${answer(attemptId, itemOne, playerId, "correct", "Lisboa", score === 100 ? 50 : 0, startedAt)}
      ${answer(
        attemptId,
        itemTwo,
        playerId,
        score === 100 ? "correct" : "incorrect",
        score === 100 ? "Marte" : "Venus",
        score === 100 ? 50 : 0,
        startedAt,
      )}
      insert into private.flash_point_entries
        (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
      values (${sqlUuid(ids.season)}, ${sqlString(playerId)}, ${publicationId}, ${attemptId},
        'accreditation', ${score}, ${sqlString(`s07-ledger-${attemptId}`)});`;

    return `
begin;
set session_replication_role = replica;
insert into public.rooms (id, slug, title, description)
values (${sqlUuid(ids.room)}, 's07-main', 'Sala histórica S07', 'Historial y revisión competitiva persistidos.');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid(ids.room)}, ${sqlString(alice)}, 'owner', 'active', ${sqlString(start)}),
  (${sqlUuid(ids.room)}, ${sqlString(bob)}, 'spectator', 'active', ${sqlString(start)}),
  (${sqlUuid(ids.room)}, ${sqlString(carol)}, 'member', 'active', ${sqlString(start)}),
  (${sqlUuid(ids.room)}, ${sqlString(dave)}, 'member', 'active', ${sqlString(start)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid(ids.season)}, ${sqlUuid(ids.room)}, 'Temporada S07', 'active',
  ${sqlString(start)}, ${sqlString(seasonEnd)});
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(ids.questionOne)}, 's07-question-one', ${sqlString(alice)}),
  (${sqlUuid(ids.questionTwo)}, 's07-question-two', ${sqlString(alice)});
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms,
   public_payload, created_by_player_id, published_at)
values
  (${sqlUuid(ids.questionVersionOne)}, ${sqlUuid(ids.questionOne)}, 1, 1, 'published',
    'multiple-choice', 15000, ${sqlString(JSON.stringify(questionOne))}, ${sqlString(alice)}, ${sqlString(start)}),
  (${sqlUuid(ids.questionVersionTwo)}, ${sqlUuid(ids.questionTwo)}, 1, 1, 'published',
    'multiple-choice', 15000, ${sqlString(JSON.stringify(questionTwo))}, ${sqlString(alice)}, ${sqlString(start)});
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (${sqlUuid(ids.questionVersionOne)}, ${sqlString(
    JSON.stringify({
      solution: { explanation: "S07_EXPLANATION_ONE", payload: { correctAnswer: "Lisboa" } },
      reveals: [],
    }),
  )}),
  (${sqlUuid(ids.questionVersionTwo)}, ${sqlString(
    JSON.stringify({
      solution: { explanation: "S07_EXPLANATION_TWO", payload: { correctAnswer: "Marte" } },
      reveals: [],
    }),
  )});
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid(ids.challenge)}, 's07-flash-history', ${sqlString(alice)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode, title,
   subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${version}, ${sqlUuid(ids.challenge)}, 1, 1, 'published', 'flash', 'Flash histórico S07',
  'Dos preguntas de 50 puntos', 'Versión histórica para revisar resultados.', 100, '{}',
  ${sqlString(alice)}, ${sqlString(start)});
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (${itemOne}, ${version}, ${sqlUuid(ids.questionVersionOne)}, 1, 50, 1, '{}'),
  (${itemTwo}, ${version}, ${sqlUuid(ids.questionVersionTwo)}, 2, 50, 1, '{}');
insert into private.question_definitions (id, slug, created_by_player_id)
values
  ${pyramidQuestionDefinitions
    .map(
      (questionId, index) =>
        `(${questionId}, 's07-pyramid-question-${index + 3}', ${sqlString(alice)})`,
    )
    .join(",\n  ")};
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms,
   public_payload, created_by_player_id, published_at)
values
  ${pyramidQuestionVersions
    .map(
      (questionVersionId, index) =>
        `(${questionVersionId}, ${pyramidQuestionDefinitions[index]}, 1, 1, 'published',
    'multiple-choice', 15000, ${sqlString(JSON.stringify(pyramidQuestions[index]))}, ${sqlString(alice)}, ${sqlString(start)})`,
    )
    .join(",\n  ")};
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  ${pyramidQuestionVersions
    .map(
      (questionVersionId, index) =>
        `(${questionVersionId}, ${sqlString(
          JSON.stringify({
            solution: {
              explanation: `S07_PYRAMID_EXPLANATION_${index + 3}`,
              payload: { correctAnswer: "A" },
            },
            reveals: [],
          }),
        )})`,
    )
    .join(",\n  ")};
insert into private.challenge_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid(ids.survivalChallenge)}, 's07-survival-history', ${sqlString(alice)}),
  (${sqlUuid(ids.pyramidChallenge)}, 's07-pyramid-history', ${sqlString(alice)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode, title,
   subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values
  (${survivalVersion}, ${sqlUuid(ids.survivalChallenge)}, 1, 1, 'published', 'survival',
   'Supervivencia histórica S07', 'Dos preguntas de supervivencia', 'Versión histórica de supervivencia.',
   100, '{"lives":2}', ${sqlString(alice)}, ${sqlString(start)}),
  (${pyramidVersion}, ${sqlUuid(ids.pyramidChallenge)}, 1, 1, 'published', 'pyramid',
   'Pirámide histórica S07', 'Siete niveles', 'Versión histórica de pirámide.',
   100, '{}', ${sqlString(alice)}, ${sqlString(start)});
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (${survivalItemOne}, ${survivalVersion}, ${sqlUuid(ids.questionVersionOne)}, 1, 50, 1, '{}'),
  (${survivalItemTwo}, ${survivalVersion}, ${sqlUuid(ids.questionVersionTwo)}, 2, 50, 1, '{}'),
  ${pyramidItems
    .map((itemId, index) => {
      const questionVersionId =
        index < 2
          ? sqlUuid(index === 0 ? ids.questionVersionOne : ids.questionVersionTwo)
          : pyramidQuestionVersions[index - 2];
      return `(${itemId}, ${pyramidVersion}, ${questionVersionId}, ${index + 1}, 15, 1,
    ${sqlString(
      JSON.stringify({
        levelId: `level-${index + 1}`,
        label: `Nivel ${index + 1}`,
        briefing: {
          title: `Briefing ${index + 1}`,
          format: "multiple-choice",
          description: `Descripción del nivel ${index + 1}`,
        },
      }),
    )})`;
    })
    .join(",\n  ")};
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values
  (${pub(ids.publicationCompleted)}, ${sqlUuid(ids.season)}, ${version}, 1, 'open',
    ${sqlString("2026-01-01T00:00:00Z")}, ${sqlString("2026-01-02T00:00:00Z")}),
  (${pub(ids.publicationAbandoned)}, ${sqlUuid(ids.season)}, ${version}, 2, 'closed',
    ${sqlString("2026-01-03T00:00:00Z")}, ${sqlString("2026-01-04T00:00:00Z")}),
  (${pub(ids.publicationEmpty)}, ${sqlUuid(ids.season)}, ${version}, 3, 'scheduled',
    ${sqlString("2026-01-05T00:00:00Z")}, ${sqlString("2026-01-06T00:00:00Z")}),
  (${pub(ids.publicationInProgress)}, ${sqlUuid(ids.season)}, ${version}, 4, 'closed',
    ${sqlString("2026-01-07T00:00:00Z")}, ${sqlString("2026-01-08T00:00:00Z")});
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at, cancelled_at)
values (${pub(ids.publicationArchived)}, ${sqlUuid(ids.season)}, ${version}, 6, 'closed',
  ${sqlString("2026-01-11T00:00:00Z")}, ${sqlString("2026-01-12T00:00:00Z")}, null);
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at, cancelled_at)
values (${pub(ids.publicationCancelled)}, ${sqlUuid(ids.season)}, ${version}, 5, 'cancelled',
  ${sqlString("2026-01-09T00:00:00Z")}, ${sqlString("2026-01-10T00:00:00Z")},
  ${sqlString("2026-01-09T00:00:00Z")});
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at, cancelled_at)
values
  (${pub(ids.publicationSurvival)}, ${sqlUuid(ids.season)}, ${survivalVersion}, 7, 'closed',
    ${sqlString("2026-01-13T00:00:00Z")}, ${sqlString("2026-01-14T00:00:00Z")}, null),
  (${pub(ids.publicationPyramid)}, ${sqlUuid(ids.season)}, ${pyramidVersion}, 8, 'closed',
    ${sqlString("2026-01-15T00:00:00Z")}, ${sqlString("2026-01-16T00:00:00Z")}, null);
${completedAttempt(
  attempt(ids.attemptAliceCompleted),
  pub(ids.publicationCompleted),
  alice,
  100,
  "2026-01-01T10:00:00Z",
  "2026-01-02T10:00:00Z",
)}
${completedAttempt(
  attempt(ids.attemptCarolCompleted),
  pub(ids.publicationCompleted),
  carol,
  100,
  "2026-01-01T10:00:00Z",
  "2026-01-02T10:01:00Z",
)}
${completedAttempt(
  attempt(ids.attemptDaveCompleted),
  pub(ids.publicationCompleted),
  dave,
  50,
  "2026-01-01T10:00:00Z",
  "2026-01-02T10:02:00Z",
)}
insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, attempt_number, kind,
   status, started_at, completed_at, score, client_state_schema_version, lock_version)
values (${attempt(ids.attemptCarolAbandoned)}, ${sqlString(carol)}, ${pub(ids.publicationAbandoned)},
  ${version}, 1, 'competitive', 'abandoned', ${sqlString("2026-01-03T10:00:00Z")},
  ${sqlString("2026-01-03T10:01:00Z")}, null, 1, 1);
${answer(
  attempt(ids.attemptCarolAbandoned),
  itemOne,
  carol,
  "incorrect",
  "Oporto",
  0,
  "2026-01-03T10:00:00Z",
)}
insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, attempt_number, kind,
   status, started_at, client_state_schema_version, lock_version)
values (${attempt(ids.attemptAliceInProgress)}, ${sqlString(alice)}, ${pub(ids.publicationInProgress)},
  ${version}, 1, 'competitive', 'in_progress', ${sqlString(inProgressStarted)}, 1, 1);
${completedAttempt(
  attempt(ids.attemptDaveArchived),
  pub(ids.publicationArchived),
  dave,
  50,
  "2026-01-11T10:00:00Z",
  "2026-01-12T10:00:00Z",
)}
insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, attempt_number, kind,
   status, started_at, completed_at, score, client_state_schema_version, lock_version, outcome)
values
  (${attempt(ids.attemptSurvival)}, ${sqlString(carol)}, ${pub(ids.publicationSurvival)}, ${survivalVersion},
   1, 'competitive', 'completed', ${sqlString("2026-01-13T10:00:00Z")},
   ${sqlString("2026-01-14T00:10:00Z")}, 50, 1, 1, 'survived'),
  (${attempt(ids.attemptPyramid)}, ${sqlString(carol)}, ${pub(ids.publicationPyramid)}, ${pyramidVersion},
   1, 'competitive', 'completed', ${sqlString("2026-01-15T10:00:00Z")},
   ${sqlString("2026-01-16T00:10:00Z")}, 15, 1, 1, 'failed');
${answer(
  attempt(ids.attemptSurvival),
  survivalItemOne,
  carol,
  "correct",
  "Lisboa",
  50,
  "2026-01-13T10:00:00Z",
  survivalVersion,
)}
${answer(
  attempt(ids.attemptPyramid),
  pyramidItems[0],
  carol,
  "correct",
  "A",
  15,
  "2026-01-15T10:00:00Z",
  pyramidVersion,
)}
${answer(
  attempt(ids.attemptPyramid),
  pyramidItems[1],
  carol,
  "incorrect",
  "B",
  0,
  "2026-01-15T10:01:00Z",
  pyramidVersion,
)}
insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
values
  (${sqlUuid(ids.season)}, ${sqlString(carol)}, ${pub(ids.publicationSurvival)}, ${attempt(ids.attemptSurvival)},
   'accreditation', 50, ${sqlString("s07-ledger-survival")}),
  (${sqlUuid(ids.season)}, ${sqlString(carol)}, ${pub(ids.publicationPyramid)}, ${attempt(ids.attemptPyramid)},
   'accreditation', 15, ${sqlString("s07-ledger-pyramid")});
${additionalHistorySql({ sqlString, sqlUuid, alice, carol, answer })}
update private.question_versions set status = 'archived' where id in
  (${sqlUuid(ids.questionVersionOne)}, ${sqlUuid(ids.questionVersionTwo)}, ${pyramidQuestionVersions.join(", ")});
update private.challenge_versions set status = 'archived' where id in (${version}, ${survivalVersion}, ${pyramidVersion});
set session_replication_role = origin;
commit;
`;
  },

  manifest({ stableId }) {
    return {
      room: { id: stableId(ids.room), slug: "s07-main" },
      seasonId: stableId(ids.season),
      publicationIds: {
        completed: stableId(ids.publicationCompleted),
        abandoned: stableId(ids.publicationAbandoned),
        empty: stableId(ids.publicationEmpty),
        inProgress: stableId(ids.publicationInProgress),
        cancelled: stableId(ids.publicationCancelled),
        archived: stableId(ids.publicationArchived),
        survival: stableId(ids.publicationSurvival),
        pyramid: stableId(ids.publicationPyramid),
        alphabet: stableId("s07-publication-alphabet"),
        narrative: stableId("s07-publication-narrative"),
      },
      challengeVersionId: stableId(ids.challengeVersion),
      challengeItemIds: [stableId(ids.challengeItemOne), stableId(ids.challengeItemTwo)],
    };
  },
};

export default scenario;
