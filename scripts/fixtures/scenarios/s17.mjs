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
    };
  },
};

export default scenario;
