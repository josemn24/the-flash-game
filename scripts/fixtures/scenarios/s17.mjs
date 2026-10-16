const namespace = "the-flash-game:s17";

export const scenario = {
  id: "s17",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador S17" },
    { label: "owner", displayName: "Owner S17" },
    { label: "member", displayName: "Member S17" },
    { label: "outsider", displayName: "Outsider S17" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    return `
begin;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
-- Publish the reusable target first, so it sorts after the 125 newer questions.
insert into private.question_definitions(id, slug, created_by_player_id)
values (${sqlUuid("library-tail-definition")}, 's17-library-tail', ${sqlString(accounts.superadmin.playerId)});
insert into private.question_versions(id, question_definition_id, version_number, type, time_limit_ms, public_payload, created_by_player_id)
values (${sqlUuid("library-tail-version")}, ${sqlUuid("library-tail-definition")}, 1, 'multiple-choice', 15000,
  '{"question":"Pregunta al final de la biblioteca S17","category":"S17","tags":{},"options":["A","B"],"media":null,"promptVisual":null}',
  ${sqlString(accounts.superadmin.playerId)});
insert into private.question_version_solutions(question_version_id, solution_payload)
values (${sqlUuid("library-tail-version")}, '{"correctAnswer":"A","explanation":"Solución S17 privada"}');
update private.question_versions set status = 'published' where id = ${sqlUuid("library-tail-version")};
insert into private.question_definitions(id, slug, created_by_player_id)
select md5(${sqlString(namespace)} || ':library-definition:' || n)::uuid, 's17-library-filler-' || lpad(n::text,3,'0'),
  ${sqlString(accounts.superadmin.playerId)} from generate_series(1,125) n;
insert into private.question_versions(id, question_definition_id, version_number, type, time_limit_ms, public_payload, created_by_player_id)
select md5(${sqlString(namespace)} || ':library-version:' || n)::uuid,
  md5(${sqlString(namespace)} || ':library-definition:' || n)::uuid, 1, 'true-false', 15000,
  jsonb_build_object('question','Pregunta de relleno S17 ' || n,'category','S17','tags','{}'::jsonb),
  ${sqlString(accounts.superadmin.playerId)} from generate_series(1,125) n;
insert into private.question_version_solutions(question_version_id, solution_payload)
select md5(${sqlString(namespace)} || ':library-version:' || n)::uuid, '{"correctAnswer":true}'::jsonb from generate_series(1,125) n;
update private.question_versions set status='published' where question_definition_id in (
  select md5(${sqlString(namespace)} || ':library-definition:' || n)::uuid from generate_series(1,125) n);
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("room")}, 's17-room', 'Sala S17', 'Sala de corrección editorial S17', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("room")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("room")}, ${sqlString(accounts.member.playerId)}, 'member');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("season")}, ${sqlUuid("room")}, 'Temporada S17', 'active', now() - interval '1 day', now() + interval '7 days');
commit;
`;
  },

  manifest({ accounts, stableId }) {
    return {
      roomId: stableId("room"),
      roomSlug: "s17-room",
      seasonId: stableId("season"),
      memberPlayerId: accounts.member.playerId,
      libraryTailQuestionVersionId: stableId("library-tail-version"),
    };
  },
};

export default scenario;
