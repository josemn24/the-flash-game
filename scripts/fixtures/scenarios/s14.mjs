const namespace = "the-flash-game:s14";

export const scenario = {
  id: "s14",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador S14" },
    { label: "owner", displayName: "Owner S14" },
    { label: "member", displayName: "Member S14" },
    { label: "spectator", displayName: "Spectator S14" },
    { label: "outsider", displayName: "Outsider S14" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    return `
begin;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("room")}, 's14-room', 'Sala S14', 'Sala de Supervivencia S14', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("room")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("room")}, ${sqlString(accounts.member.playerId)}, 'member'),
  (${sqlUuid("room")}, ${sqlString(accounts.spectator.playerId)}, 'spectator');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("season")}, ${sqlUuid("room")}, 'Temporada S14', 'active', now() - interval '1 day', now() + interval '7 days');
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("e2e-room")}, 's14-e2e-room', 'Sala S14 E2E', 'Sala dedicada al recorrido E2E S14', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("e2e-room")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("e2e-room")}, ${sqlString(accounts.member.playerId)}, 'member'),
  (${sqlUuid("e2e-room")}, ${sqlString(accounts.spectator.playerId)}, 'spectator');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("e2e-season")}, ${sqlUuid("e2e-room")}, 'Temporada S14 E2E', 'active', now() - interval '1 day', now() + interval '7 days');
commit;
`;
  },

  manifest({ accounts, stableId }) {
    return {
      roomId: stableId("room"),
      roomSlug: "s14-room",
      seasonId: stableId("season"),
      e2eRoomId: stableId("e2e-room"),
      e2eRoomSlug: "s14-e2e-room",
      e2eSeasonId: stableId("e2e-season"),
      memberPlayerId: accounts.member.playerId,
      spectatorPlayerId: accounts.spectator.playerId,
    };
  },
};

export default scenario;
