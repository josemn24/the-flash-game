const namespace = "the-flash-game:s02";
const domainIds = {
  mainRoom: "s02-room-main",
  noSeasonRoom: "s02-room-no-season",
  spectatorRoom: "s02-room-spectator",
  leftRoom: "s02-room-left",
  otherRoom: "s02-room-other",
  mainSeason: "s02-season-main",
  spectatorSeason: "s02-season-spectator",
  otherSeason: "s02-season-other",
  questionOne: "s02-question-one",
  questionTwo: "s02-question-two",
  questionVersionOne: "s02-question-version-one",
  questionVersionTwo: "s02-question-version-two",
  challenge: "s02-challenge",
  challengeVersion: "s02-challenge-version",
  challengeItemOne: "s02-challenge-item-one",
  challengeItemTwo: "s02-challenge-item-two",
  publication: "s02-publication",
  spectatorPublication: "s02-spectator-publication",
};

const roomSlugs = {
  mainRoom: "s02-main",
  noSeasonRoom: "s02-no-season",
  spectatorRoom: "s02-spectator",
  leftRoom: "s02-left",
  otherRoom: "s02-other",
};

export const scenario = {
  id: "s02",
  namespace,
  users: [
    { label: "alice", displayName: "Alice" },
    { label: "bob", displayName: "Bob" },
  ],

  buildDomainSql({ accounts, sqlString, sqlUuid }) {
    const alice = accounts.alice.playerId;
    const bob = accounts.bob.playerId;
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";

    return `
begin;
set constraints all deferred;
insert into public.rooms (id, slug, title, description) values
  (${sqlUuid(domainIds.mainRoom)}, 's02-main', 'Sala principal', 'Sala principal de S02'),
  (${sqlUuid(domainIds.noSeasonRoom)}, 's02-no-season', 'Sala sin temporada', 'Sin reto publicado'),
  (${sqlUuid(domainIds.spectatorRoom)}, 's02-spectator', 'Sala de espectador', 'Acceso de solo lectura'),
  (${sqlUuid(domainIds.leftRoom)}, 's02-left', 'Sala abandonada', 'Membresía finalizada'),
  (${sqlUuid(domainIds.otherRoom)}, 's02-other', 'Sala externa', 'Sin acceso para Alice');
insert into public.room_memberships (room_id, player_id, role, status, joined_at, ended_at) values
  (${sqlUuid(domainIds.mainRoom)}, ${sqlString(alice)}, 'owner', 'active', ${sqlString(dateStart)}, null),
  (${sqlUuid(domainIds.mainRoom)}, ${sqlString(bob)}, 'admin', 'active', ${sqlString(dateStart)}, null),
  (${sqlUuid(domainIds.noSeasonRoom)}, ${sqlString(bob)}, 'owner', 'active', ${sqlString(dateStart)}, null),
  (${sqlUuid(domainIds.noSeasonRoom)}, ${sqlString(alice)}, 'member', 'active', ${sqlString(dateStart)}, null),
  (${sqlUuid(domainIds.spectatorRoom)}, ${sqlString(alice)}, 'owner', 'active', ${sqlString(dateStart)}, null),
  (${sqlUuid(domainIds.spectatorRoom)}, ${sqlString(bob)}, 'spectator', 'active', ${sqlString(dateStart)}, null),
  (${sqlUuid(domainIds.leftRoom)}, ${sqlString(bob)}, 'owner', 'active', ${sqlString(dateStart)}, null),
  (${sqlUuid(domainIds.leftRoom)}, ${sqlString(alice)}, 'member', 'left', ${sqlString(dateStart)}, ${sqlString("2000-02-01T00:00:00Z")}),
  (${sqlUuid(domainIds.otherRoom)}, ${sqlString(bob)}, 'owner', 'active', ${sqlString(dateStart)}, null);
insert into public.seasons (id, room_id, title, status, starts_at, ends_at) values
  (${sqlUuid(domainIds.mainSeason)}, ${sqlUuid(domainIds.mainRoom)}, 'Temporada principal', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)}),
  (${sqlUuid(domainIds.spectatorSeason)}, ${sqlUuid(domainIds.spectatorRoom)}, 'Temporada de lectura', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)}),
  (${sqlUuid(domainIds.otherSeason)}, ${sqlUuid(domainIds.otherRoom)}, 'Temporada externa', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.question_definitions (id, slug, created_by_player_id) values
  (${sqlUuid(domainIds.questionOne)}, 's02-question-one', ${sqlString(alice)}),
  (${sqlUuid(domainIds.questionTwo)}, 's02-question-two', ${sqlString(alice)});
insert into private.question_versions
  (id, question_definition_id, version_number, type, time_limit_ms, public_payload, created_by_player_id) values
  (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionOne)}, 1, 'short-text', 60000,
    '{"prompt":"S02_PRIVATE_PROMPT_ONE"}', ${sqlString(alice)}),
  (${sqlUuid(domainIds.questionVersionTwo)}, ${sqlUuid(domainIds.questionTwo)}, 1, 'short-text', 60000,
    '{"prompt":"S02_PRIVATE_PROMPT_TWO"}', ${sqlString(alice)});
insert into private.question_version_solutions (question_version_id, solution_payload) values
  (${sqlUuid(domainIds.questionVersionOne)}, '{"answer":"S02_PRIVATE_SOLUTION_ONE"}'),
  (${sqlUuid(domainIds.questionVersionTwo)}, '{"answer":"S02_PRIVATE_SOLUTION_TWO"}');
update private.question_versions
set status = 'published'
where id in (${sqlUuid(domainIds.questionVersionOne)}, ${sqlUuid(domainIds.questionVersionTwo)});
insert into private.challenge_definitions (id, slug, created_by_player_id)
  values (${sqlUuid(domainIds.challenge)}, 's02-private-challenge', ${sqlString(alice)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, mode, title, subtitle, description, created_by_player_id)
  values (${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.challenge)}, 1, 'flash',
    'Flash: Metadatos privados S02', 'Dos preguntas de 50 puntos', 'No se entrega en S02', ${sqlString(alice)});
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points) values
  (${sqlUuid(domainIds.challengeItemOne)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionOne)}, 1, 50),
  (${sqlUuid(domainIds.challengeItemTwo)}, ${sqlUuid(domainIds.challengeVersion)}, ${sqlUuid(domainIds.questionVersionTwo)}, 2, 50);
update private.challenge_versions
set status = 'published'
where id = ${sqlUuid(domainIds.challengeVersion)};
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at) values
  (${sqlUuid(domainIds.publication)}, ${sqlUuid(domainIds.mainSeason)}, ${sqlUuid(domainIds.challengeVersion)}, 1, 'open',
    ${sqlString(dateStart)}, ${sqlString(dateEnd)}),
  (${sqlUuid(domainIds.spectatorPublication)}, ${sqlUuid(domainIds.spectatorSeason)}, ${sqlUuid(domainIds.challengeVersion)}, 1, 'open',
    ${sqlString(dateStart)}, ${sqlString(dateEnd)});
set constraints all immediate;
commit;
`;
  },

  manifest({ stableId }) {
    return {
      rooms: Object.fromEntries(
        Object.keys(roomSlugs).map((key) => [
          key,
          { id: stableId(domainIds[key]), slug: roomSlugs[key] },
        ]),
      ),
      publicationId: stableId(domainIds.publication),
      spectatorPublicationId: stableId(domainIds.spectatorPublication),
    };
  },
};

export default scenario;
