/** Small persisted fixtures for session coordination; uses the existing publication rules. */
export function sessionFixture({
  id,
  mode,
  title,
  questions,
  modeConfig = {},
  globalTimeLimitMs = null,
}) {
  return {
    id,
    namespace: `the-flash-game:${id}`,
    users: ["alice", "bob", "carol", "dave"].map((label) => ({
      label,
      displayName: `${label} ${id}`,
    })),
    buildDomainSql({ accounts, sqlString: quote, sqlUuid: uuid }) {
      const start = "2000-01-01T00:00:00Z";
      const end = "2999-01-01T00:00:00Z";
      const author = quote(accounts.alice.playerId);
      const values = (rows) => rows.join(",\n");
      return `
begin;
set constraints all deferred;
insert into public.rooms (id, slug, title, description) values (${uuid("room")}, ${quote(`${id}-main`)}, ${quote(`Sala ${id}`)}, 'Fixture de coordinación competitiva');
insert into public.room_memberships (room_id, player_id, role, status, joined_at) values ${values(Object.entries(accounts).map(([label, account]) => `(${uuid("room")}, ${quote(account.playerId)}, '${label === "alice" ? "owner" : "member"}', 'active', ${quote(start)})`))};
insert into public.seasons (id, room_id, title, status, starts_at, ends_at) values (${uuid("season")}, ${uuid("room")}, ${quote(`Temporada ${id}`)}, 'active', ${quote(start)}, ${quote(end)});
insert into private.question_definitions (id, slug, created_by_player_id) values ${values(questions.map((q, i) => `(${uuid(`question-${i}`)}, ${quote(`${id}-question-${i}`)}, ${author})`))};
insert into private.question_versions (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms, public_payload, created_by_player_id) values ${values(questions.map((q, i) => `(${uuid(`version-${i}`)}, ${uuid(`question-${i}`)}, 1, 1, ${quote(q.type)}, ${q.timeLimitMs ?? 60000}, ${quote(JSON.stringify(q.publicPayload))}, ${author})`))};
insert into private.question_version_solutions (question_version_id, solution_payload) values ${values(questions.map((q, i) => `(${uuid(`version-${i}`)}, ${quote(JSON.stringify(q.solution))})`))};
update private.question_versions set status = 'published', published_at = ${quote(start)} where id in (${questions.map((q, i) => uuid(`version-${i}`)).join(", ")});
insert into private.challenge_definitions (id, slug, created_by_player_id) values (${uuid("challenge")}, ${quote(`${id}-definition`)}, ${author});
insert into private.challenge_versions (id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, global_time_limit_ms, mode_config, created_by_player_id, published_at)
values (${uuid("challenge-version")}, ${uuid("challenge")}, 1, 1, 'draft', ${quote(mode)}, ${quote(title)}, 'Recorrido competitivo de prueba', 'Sesión persistida', 100, ${globalTimeLimitMs ?? "null"}, ${quote(JSON.stringify(modeConfig))}, ${author}, null);
insert into private.challenge_items (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config) values ${values(questions.map((q, i) => `(${uuid(`item-${i}`)}, ${uuid("challenge-version")}, ${uuid(`version-${i}`)}, ${i + 1}, ${Math.floor(100 / questions.length) + (i === questions.length - 1 ? 100 % questions.length : 0)}, 1, ${quote(JSON.stringify(mode === "alphabet" ? { letter: q.letter } : mode === "narrative" ? { questionSlug: `${id}-question-${i}` } : mode === "pyramid" ? q.modeConfig : {}))})`))};
update private.challenge_versions set status = 'published', published_at = ${quote(start)} where id = ${uuid("challenge-version")};
insert into public.scheduled_challenges (id, season_id, challenge_version_id, number, status, opens_at, closes_at) values (${uuid("publication")}, ${uuid("season")}, ${uuid("challenge-version")}, 1, 'open', ${quote(start)}, ${quote(end)});
set constraints all immediate;
commit;
`;
    },
    manifest({ stableId }) {
      return {
        room: { id: stableId("room"), slug: `${id}-main` },
        publicationId: stableId("publication"),
        challengeItemIds: questions.map((q, i) => stableId(`item-${i}`)),
      };
    },
  };
}
