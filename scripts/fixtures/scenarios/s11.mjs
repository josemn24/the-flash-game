const namespace = "the-flash-game:s11";

export const scenario = {
  id: "s11",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador S11" },
    { label: "owner", displayName: "Owner S11" },
    { label: "member", displayName: "Member S11" },
    { label: "outsider", displayName: "Outsider S11" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    return `
begin;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description, time_zone, status)
values (${sqlUuid("room")}, 's11-room', 'Sala S11', 'Sala del vertical S11', 'Europe/Madrid', 'active');
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid("room")}, ${sqlString(accounts.owner.playerId)}, 'owner'),
  (${sqlUuid("room")}, ${sqlString(accounts.member.playerId)}, 'member');
commit;
`;
  },

  manifest({ accounts, stableId }) {
    return {
      roomId: stableId("room"),
      roomSlug: "s11-room",
      memberPlayerId: accounts.member.playerId,
    };
  },
};

export default scenario;
