/** Extra persisted modes for the common history/ranking/review path. */
export function additionalHistorySql({ sqlString, sqlUuid, alice, carol, answer }) {
  const alphabetVersion = sqlUuid("s07-alphabet-version");
  const narrativeVersion = sqlUuid("s07-narrative-version");
  const alphabetPublication = sqlUuid("s07-publication-alphabet");
  const narrativePublication = sqlUuid("s07-publication-narrative");
  const completed = sqlUuid("s07-attempt-alphabet-completed");
  const abandoned = sqlUuid("s07-attempt-alphabet-abandoned");
  const narrativeAttempt = sqlUuid("s07-attempt-narrative");
  const letters = ["B", "A", "Ñ", "Z"];
  const question = (index) => sqlUuid(`s07-alphabet-question-${index}`);
  const questionVersion = (index) => sqlUuid(`s07-alphabet-question-version-${index}`);
  const item = (index) => sqlUuid(`s07-alphabet-item-${index}`);
  return `
insert into private.question_definitions(id, slug, created_by_player_id) values
${letters.map((_, index) => `(${question(index)}, 's07-alphabet-question-${index}', ${sqlString(alice)})`).join(",\n")};
insert into private.question_versions(id, question_definition_id, version_number, status, type,
  time_limit_ms, public_payload, created_by_player_id, published_at) values
${letters
  .map(
    (
      letter,
      index,
    ) => `(${questionVersion(index)}, ${question(index)}, 1, 'archived', 'short-text', 30000,
  ${sqlString(JSON.stringify({ question: `Pregunta histórica de la letra ${letter}` }))}, ${sqlString(alice)}, '2026-01-01T00:00:00Z')`,
  )
  .join(",\n")};
insert into private.question_version_solutions(question_version_id, solution_payload) values
${letters.map((_, index) => `(${questionVersion(index)}, ${sqlString(JSON.stringify({ correctAnswer: "Lovelace", acceptedAnswers: ["Lovelace"], explanation: `S07_ALPHABET_EXPLANATION_${index}` }))})`).join(",\n")};
insert into private.challenge_definitions(id, slug, created_by_player_id) values
  (${sqlUuid("s07-alphabet-challenge")}, 's07-alphabet-history', ${sqlString(alice)}),
  (${sqlUuid("s07-narrative-challenge")}, 's07-narrative-history', ${sqlString(alice)});
insert into private.challenge_versions(id, challenge_definition_id, version_number, status, mode,
  title, subtitle, description, max_score, global_time_limit_ms, mode_config, created_by_player_id, published_at) values
  (${alphabetVersion}, ${sqlUuid("s07-alphabet-challenge")}, 1, 'archived', 'alphabet', 'Alfabeto histórico S07',
    'Cuatro letras', 'Revisión completa de Alfabeto', 100, 90000, '{}', ${sqlString(alice)}, '2026-01-01T00:00:00Z'),
  (${narrativeVersion}, ${sqlUuid("s07-narrative-challenge")}, 1, 'archived', 'narrative', 'Narrativa histórica S07',
    'Dos preguntas', 'Revisión de Narrativa', 100, null, '{}', ${sqlString(alice)}, '2026-01-01T00:00:00Z');
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, mode_config) values
${letters.map((letter, index) => `(${item(index)}, ${alphabetVersion}, ${questionVersion(index)}, ${index + 1}, 25, ${sqlString(JSON.stringify({ letter }))})`).join(",\n")},
  (${sqlUuid("s07-narrative-item-1")}, ${narrativeVersion}, ${sqlUuid("s07-question-version-one")}, 1, 50, '{}'),
  (${sqlUuid("s07-narrative-item-2")}, ${narrativeVersion}, ${sqlUuid("s07-question-version-two")}, 2, 50, '{}');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at) values
  (${alphabetPublication}, ${sqlUuid("s07-season-main")}, ${alphabetVersion}, 9, 'scheduled', '2026-01-17T00:00:00Z', '2026-01-18T00:00:00Z'),
  (${narrativePublication}, ${sqlUuid("s07-season-main")}, ${narrativeVersion}, 10, 'open', '2026-01-19T00:00:00Z', '2026-01-20T00:00:00Z');
insert into public.attempts(id, player_id, scheduled_challenge_id, challenge_version_id, kind, status,
  started_at, completed_at, score, client_state_schema_version) values
  (${completed}, ${sqlString(carol)}, ${alphabetPublication}, ${alphabetVersion}, 'competitive', 'completed', '2026-01-17T10:00:00Z', '2026-01-17T10:01:00Z', 25, 1),
  (${abandoned}, ${sqlString(alice)}, ${alphabetPublication}, ${alphabetVersion}, 'competitive', 'abandoned', '2026-01-17T10:00:00Z', '2026-01-17T10:00:30Z', null, 1),
  (${narrativeAttempt}, ${sqlString(carol)}, ${narrativePublication}, ${narrativeVersion}, 'competitive', 'completed', '2026-01-19T10:00:00Z', '2026-01-19T10:01:00Z', 50, 1);
${answer(completed, item(0), carol, "correct", "Lovelace", 25, "2026-01-17T10:00:00Z", alphabetVersion)}
${answer(completed, item(1), carol, "incorrect", "Other", 0, "2026-01-17T10:00:10Z", alphabetVersion)}
${answer(completed, item(2), carol, "timeout", null, 0, "2026-01-17T10:00:20Z", alphabetVersion)}
${answer(narrativeAttempt, sqlUuid("s07-narrative-item-1"), carol, "correct", "Lisboa", 50, "2026-01-19T10:00:00Z", narrativeVersion)}
insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key) values
  (${sqlUuid("s07-season-main")}, ${sqlString(carol)}, ${alphabetPublication}, ${completed}, 'accreditation', 25, 's07-alphabet-ledger'),
  (${sqlUuid("s07-season-main")}, ${sqlString(carol)}, ${narrativePublication}, ${narrativeAttempt}, 'accreditation', 50, 's07-narrative-ledger');
`;
}
