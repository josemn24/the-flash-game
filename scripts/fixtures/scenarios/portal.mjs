const namespace = "the-flash-game:portal";
const domainIds = {
  activeRoomOne: "portal-room-one",
  activeRoomTwo: "portal-room-two",
  deletedRoom: "portal-room-deleted",
};

export const scenario = {
  id: "portal",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador beta" },
    { label: "member", displayName: "Jugador beta" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    return `
begin;
set constraints all deferred;
insert into public.rooms (id, slug, title, status, deleted_at) values
  (${sqlUuid(domainIds.activeRoomOne)}, 'portal-alpha', 'Sala Alpha', 'active', null),
  (${sqlUuid(domainIds.activeRoomTwo)}, 'portal-beta', 'Sala Beta', 'active', null),
  (${sqlUuid(domainIds.deletedRoom)}, 'portal-deleted', 'Sala archivada', 'deleted', now());
insert into public.room_memberships (room_id, player_id, role)
values
  (${sqlUuid(domainIds.activeRoomOne)}, ${sqlString(accounts.member.playerId)}, 'owner'),
  (${sqlUuid(domainIds.activeRoomTwo)}, ${sqlString(accounts.member.playerId)}, 'owner');
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
set constraints all immediate;
commit;
`;
  },

  manifest({ stableId }) {
    return {
      activeRooms: [
        { id: stableId(domainIds.activeRoomOne), slug: "portal-alpha" },
        { id: stableId(domainIds.activeRoomTwo), slug: "portal-beta" },
      ],
      deletedRoom: { id: stableId(domainIds.deletedRoom), slug: "portal-deleted" },
    };
  },
};

export default scenario;
