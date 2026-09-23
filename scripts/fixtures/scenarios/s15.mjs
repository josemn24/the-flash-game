const namespace = "the-flash-game:s15";

export const scenario = {
  id: "s15",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador S15" },
    { label: "owner", displayName: "Owner S15" },
    { label: "member", displayName: "Member S15" },
    { label: "interrupted", displayName: "Interrupted S15" },
    { label: "spectator", displayName: "Spectator S15" },
    { label: "outsider", displayName: "Outsider S15" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    return `
begin;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("room")}, 's15-room', 'Sala S15', 'Sala de La Pirámide S15', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("room")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("room")}, ${sqlString(accounts.member.playerId)}, 'member'),
  (${sqlUuid("room")}, ${sqlString(accounts.spectator.playerId)}, 'spectator');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("season")}, ${sqlUuid("room")}, 'Temporada S15', 'active', now() - interval '1 day', now() + interval '7 days');
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("e2e-room-fresh")}, 's15-e2e-room-fresh', 'Sala S15 E2E limpia', 'Sala dedicada al recorrido E2E S15', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("e2e-room-fresh")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("e2e-room-fresh")}, ${sqlString(accounts.member.playerId)}, 'member'),
  (${sqlUuid("e2e-room-fresh")}, ${sqlString(accounts.interrupted.playerId)}, 'member'),
  (${sqlUuid("e2e-room-fresh")}, ${sqlString(accounts.spectator.playerId)}, 'spectator');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("e2e-season-fresh")}, ${sqlUuid("e2e-room-fresh")}, 'Temporada S15 E2E limpia', 'active', now() - interval '1 day', now() + interval '7 days');
commit;
`;
  },

  manifest({ accounts, stableId }) {
    return {
      roomId: stableId("room"),
      roomSlug: "s15-room",
      seasonId: stableId("season"),
      e2eRoomId: stableId("e2e-room-fresh"),
      e2eRoomSlug: "s15-e2e-room-fresh",
      e2eSeasonId: stableId("e2e-season-fresh"),
      ownerPlayerId: accounts.owner.playerId,
      memberPlayerId: accounts.member.playerId,
      spectatorPlayerId: accounts.spectator.playerId,
    };
  },
};

export default scenario;
