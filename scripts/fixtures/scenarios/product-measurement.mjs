import base from "./s03.mjs";

// Generic rooms of different sizes; no study configuration is required.
export const scenario = {
  ...base,
  id: "product-measurement",
  namespace: "the-flash-game:product-measurement",
  users: [...base.users, { label: "superadmin", displayName: "Measurement operator" }],
  buildDomainSql(context) {
    const { accounts, sqlString, sqlUuid } = context;
    const publication = (n) =>
      sqlUuid(n === 1 ? "s03-publication" : `measurement-publication-${n}`);
    const publications = `insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at) values ${Array.from({ length: 3 }, (_, i) => `(${publication(i + 1)},${sqlUuid("s03-season-main")},${sqlUuid("s03-challenge-version")},${i + 1},'${i === 0 ? "open" : "scheduled"}',now()-interval '1 hour'+${i}*interval '24 hours',now()-interval '1 hour'+${i + 1}*interval '24 hours')`).join(",")};`;
    const initial = base
      .buildDomainSql(context)
      .replace(
        /insert into public\.scheduled_challenges[\s\S]*?set constraints all immediate;/,
        `${publications}\nset constraints all immediate;`,
      );
    return (
      initial +
      `
      begin;
      insert into private.platform_role_assignments(player_id,role) values(${sqlString(accounts.superadmin.playerId)},'superadmin');
      insert into public.rooms(id,slug,title) values(${sqlUuid("measurement-room-second")},'measurement-second','Otra sala');
      insert into public.room_memberships(room_id,player_id,role) values
        (${sqlUuid("measurement-room-second")},${sqlString(accounts.alice.playerId)},'owner'),
        (${sqlUuid("measurement-room-second")},${sqlString(accounts.carol.playerId)},'member');
      insert into public.seasons(id,room_id,title,status,starts_at,ends_at) values
        (${sqlUuid("measurement-season-second")},${sqlUuid("measurement-room-second")},'Otra temporada','active',now()-interval '1 day',now()+interval '2 days');
      insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at) values
        (${sqlUuid("measurement-publication-second")},${sqlUuid("measurement-season-second")},${sqlUuid("s03-challenge-version")},1,'open',now()-interval '1 hour',now()+interval '1 day');
      commit;`
    );
  },
  manifest(context) {
    return {
      ...base.manifest(context),
      secondRoomId: context.stableId("measurement-room-second"),
      secondRoomSlug: "measurement-second",
    };
  },
};
export default scenario;
