const namespace = "the-flash-game:s12";

export const scenario = {
  id: "s12",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador S12" },
    { label: "owner", displayName: "Owner S12" },
    { label: "member", displayName: "Member S12" },
    { label: "spectator", displayName: "Spectator S12" },
    { label: "outsider", displayName: "Outsider S12" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    return `
begin;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("room")}, 's12-room', 'Sala S12', 'Sala del calendario S12', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("room")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("room")}, ${sqlString(accounts.member.playerId)}, 'member'),
  (${sqlUuid("room")}, ${sqlString(accounts.spectator.playerId)}, 'spectator');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("season")}, ${sqlUuid("room")}, 'Temporada S12', 'active', now() - interval '1 day', now() + interval '2 days');
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid("definition")}, 's12-flash-calendar', ${sqlString(accounts.superadmin.playerId)});
insert into private.challenge_versions (
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id
)
values (
  ${sqlUuid("version")}, ${sqlUuid("definition")}, 1, 1, 'draft', 'flash',
  'Flash S12 calendario', 'Dos preguntas', 'Contenido Flash para calendario', 100, '{}'::jsonb,
  ${sqlString(accounts.superadmin.playerId)}
);
insert into private.question_definitions (id, slug, created_by_player_id)
values
  (${sqlUuid("question-definition-1")}, 's12-calendar-q1', ${sqlString(accounts.superadmin.playerId)}),
  (${sqlUuid("question-definition-2")}, 's12-calendar-q2', ${sqlString(accounts.superadmin.playerId)});
insert into private.question_versions (
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id
)
values
  (${sqlUuid("question-version-1")}, ${sqlUuid("question-definition-1")}, 1, 1, 'draft', 'multiple-choice', 15000,
    '{"category":"Cultura","tags":{},"question":"¿Capital de Portugal?","options":["Lisboa","Oporto"]}', ${sqlString(accounts.superadmin.playerId)}),
  (${sqlUuid("question-version-2")}, ${sqlUuid("question-definition-2")}, 1, 1, 'draft', 'multiple-choice', 15000,
    '{"category":"Ciencia","tags":{},"question":"¿Planeta rojo?","options":["Marte","Venus"]}', ${sqlString(accounts.superadmin.playerId)});
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (${sqlUuid("question-version-1")}, '{"correctAnswer":"Lisboa","explanation":"Lisboa."}'),
  (${sqlUuid("question-version-2")}, '{"correctAnswer":"Marte","explanation":"Marte."}');
insert into private.challenge_items (challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (${sqlUuid("version")}, ${sqlUuid("question-version-1")}, 1, 50, 1, '{}'::jsonb),
  (${sqlUuid("version")}, ${sqlUuid("question-version-2")}, 2, 50, 1, '{}'::jsonb);
update private.question_versions set status = 'published'
where id in (${sqlUuid("question-version-1")}, ${sqlUuid("question-version-2")});
update private.challenge_versions set status = 'published' where id = ${sqlUuid("version")};
commit;
`;
  },

  manifest({ accounts, stableId }) {
    return {
      roomId: stableId("room"),
      roomSlug: "s12-room",
      seasonId: stableId("season"),
      challengeVersionId: stableId("version"),
      memberPlayerId: accounts.member.playerId,
    };
  },
};

export default scenario;
