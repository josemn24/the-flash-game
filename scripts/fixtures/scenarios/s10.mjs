const namespace = "the-flash-game:s10";

export const scenario = {
  id: "s10",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador S10" },
    { label: "owner", displayName: "Owner S10" },
    { label: "member", displayName: "Member S10" },
    { label: "outsider", displayName: "Outsider S10" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    return `
begin;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("room")}, 's10-room', 'Sala S10', 'Sala del vertical S10', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("room")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("room")}, ${sqlString(accounts.member.playerId)}, 'member');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("legacy-season")}, ${sqlUuid("room")}, 'Temporada anterior', 'finished',
  '2026-01-01T00:00:00Z', '2026-01-15T00:00:00Z');
commit;
`;
  },

  manifest({ accounts, stableId }) {
    return {
      roomId: stableId("room"),
      roomSlug: "s10-room",
      memberPlayerId: accounts.member.playerId,
      legacySeasonId: stableId("legacy-season"),
    };
  },
};

export default scenario;
