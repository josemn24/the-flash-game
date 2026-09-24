import {
  createAuthenticatedClient,
  dockerSql,
  readFixture,
  rpc,
  sqlCount,
} from "../../support/supabase-local.mjs";

export const scenario = {
  id: "betavip",

  async run({ fixture, clients, config, assert }) {
    const tabarnia = await readFixture("tabarnia");
    const kike = await createAuthenticatedClient(config, tabarnia.users.kike);
    const beta = fixture.data;
    const betaSlug = beta.room.slug;
    const tabarniaSlug = beta.tabarnia.room.slug;
    const [alphabet, steel] = beta.publications;

    assert(
      JSON.stringify(
        beta.publications.map(({ number, title, mode, status }) => [number, title, mode, status]),
      ) ===
        JSON.stringify([
          [1, "La vuelta al mundo", "alphabet", "open"],
          [2, "Steel Ball Run", "flash", "scheduled"],
        ]),
      "BetaVIP publica primero el Alphabet y programa Steel Ball Run para el segundo día",
    );
    assert(beta.publicationId === alphabet.id, "El manifiesto apunta al primer desafío");
    assert(beta.steelBallRunPublicationId === steel.id, "Steel Ball Run tiene ID propio");

    assert(fixture.users.ches.playerId === tabarnia.users.ches.playerId, "Ches conserva su Player");
    assert(fixture.users.dark.playerId === tabarnia.users.dark.playerId, "Dark conserva su Player");
    assert(
      steel.challengeVersionId ===
        tabarnia.data.publications.find((publication) => publication.slug === "steel-ball-run")
          ?.challengeVersionId,
      "Las dos publicaciones comparten la versión de Steel Ball Run",
    );
    assert(
      steel.id !== beta.tabarnia.steelBallRunPublicationId,
      "Cada sala tiene una publicación propia",
    );

    assert(
      (await sqlCount("select count(*) from public.rooms;", config.dbContainer)) === 2,
      "El dataset conjunto tiene dos salas",
    );
    assert(
      (await sqlCount(
        `select count(*) from public.room_memberships where room_id = '${beta.room.id}' and status = 'active';`,
        config.dbContainer,
      )) === 4,
      "BetaVIP tiene cuatro miembros activos",
    );
    assert(
      (await sqlCount(
        `select count(*) from public.room_memberships where room_id = '${beta.tabarnia.room.id}' and status = 'active';`,
        config.dbContainer,
      )) === 12,
      "Tabarnia mantiene sus doce miembros",
    );
    assert(
      (await sqlCount(
        `select count(*) from public.room_memberships where player_id = '${fixture.users.ches.playerId}' and role = 'owner' and status = 'active';`,
        config.dbContainer,
      )) === 2,
      "Ches es owner de ambas salas",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.platform_role_assignments where player_id = '${fixture.users.xesmona.playerId}' and role = 'superadmin';`,
        config.dbContainer,
      )) === 1,
      "Xesmona conserva el rol de superadmin",
    );
    assert(
      (await sqlCount(
        `select count(*) from public.room_memberships where player_id = '${fixture.users.xesmona.playerId}';`,
        config.dbContainer,
      )) === 0,
      "Xesmona no es miembro de las salas",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_versions where id = '${steel.challengeVersionId}';`,
        config.dbContainer,
      )) === 1,
      "Steel Ball Run no se duplica",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items where challenge_version_id = '${steel.challengeVersionId}';`,
        config.dbContainer,
      )) === 16,
      "La versión compartida conserva sus dieciséis preguntas",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_versions where id = '${alphabet.challengeVersionId}' and status = 'published' and mode = 'alphabet' and global_time_limit_ms = 135000;`,
        config.dbContainer,
      )) === 1,
      "El Alphabet de BetaVIP está publicado con 135 segundos",
    );
    assert(
      (await sqlCount(
        `select count(*) from private.challenge_items i join private.question_versions q on q.id = i.question_version_id where i.challenge_version_id = '${alphabet.challengeVersionId}' and q.type = 'short-text' and i.mode_config ? 'letter';`,
        config.dbContainer,
      )) === 18,
      "La vuelta al mundo tiene dieciocho preguntas con letra",
    );
    const publicationOrder = await dockerSql(
      `select string_agg(number::text || ':' || status, ',' order by number) from public.scheduled_challenges where season_id = '${beta.seasonId}';`,
      config.dbContainer,
    );
    assert(
      publicationOrder.stdout.trim() === "1:open,2:scheduled",
      "Las publicaciones de BetaVIP están en orden y estado correctos",
    );
    assert(
      (await sqlCount(
        `select count(*) from public.seasons where id = '${beta.seasonId}' and ends_at - starts_at = interval '48 hours';`,
        config.dbContainer,
      )) === 1,
      "La temporada BetaVIP cubre exactamente las dos ventanas de 24 horas",
    );
    assert(
      (await sqlCount(
        `select count(*) from public.scheduled_challenges first join public.scheduled_challenges second on second.season_id = first.season_id join public.seasons season on season.id = first.season_id where first.id = '${alphabet.id}' and second.id = '${steel.id}' and first.opens_at = season.starts_at and first.closes_at = second.opens_at and second.closes_at = season.ends_at and private.publication_is_effectively_open(second.status, season.status, season.starts_at, season.ends_at, second.opens_at, second.closes_at, second.opens_at + interval '1 hour');`,
        config.dbContainer,
      )) === 1,
      "Steel Ball Run queda disponible el segundo día, sin huecos ni solapes",
    );
    assert(
      (await sqlCount(
        "select count(*) from private.media_assets where bucket_id = 'question-assets';",
        config.dbContainer,
      )) === 4,
      "BetaVIP reutiliza los recursos de Tabarnia",
    );

    for (const [client, expectedSlugs] of [
      [clients.ches, [tabarniaSlug, betaSlug]],
      [clients.dark, [tabarniaSlug, betaSlug]],
      [clients.manuel, [betaSlug]],
      [clients.genis, [betaSlug]],
      [clients.xesmona, []],
      [kike, [tabarniaSlug]],
    ]) {
      const cards = await rpc(client, "get_my_room_cards", {});
      assert(
        JSON.stringify(cards.map((card) => card.room_slug).sort()) ===
          JSON.stringify([...expectedSlugs].sort()),
        `Las tarjetas muestran únicamente las salas permitidas: ${expectedSlugs.join(", ")}`,
      );
    }

    for (const client of [clients.ches, clients.dark, clients.manuel, clients.genis]) {
      const playable = await rpc(client, "get_my_alphabet_challenge", {
        target_room_slug: betaSlug,
        target_publication_id: alphabet.id,
      });
      assert(playable.length === 18, "Los miembros de BetaVIP reciben las dieciocho letras");
      assert(
        playable.reduce((total, row) => total + Number(row.item_points), 0) === 100,
        "La vuelta al mundo suma 100 puntos",
      );
      assert(
        playable.map((row) => row.alphabet_letter).join(",") ===
          "A,B,C,D,E,F,G,H,I,J,L,M,O,P,R,S,T,Z",
        "La vuelta al mundo conserva el orden de las letras",
      );
      assert(
        !JSON.stringify(playable).match(/correctAnswer|acceptedAnswers|solutionPayload/i),
        "La lectura jugable no expone soluciones",
      );
    }
    assert(
      (
        await rpc(clients.ches, "get_my_flash_challenge", {
          target_room_slug: betaSlug,
          target_publication_id: steel.id,
        })
      ).length === 0,
      "Steel Ball Run aún está programado en BetaVIP",
    );
    assert(
      (
        await rpc(clients.ches, "get_my_flash_challenge", {
          target_room_slug: tabarniaSlug,
          target_publication_id: beta.tabarnia.steelBallRunPublicationId,
        })
      ).length === 0,
      "Steel Ball Run sigue programado en Tabarnia",
    );
    assert(
      (
        await rpc(kike, "get_my_alphabet_challenge", {
          target_room_slug: betaSlug,
          target_publication_id: alphabet.id,
        })
      ).length === 0,
      "Un miembro exclusivo de Tabarnia no puede jugar el Alphabet de BetaVIP",
    );
    assert(
      (await rpc(clients.manuel, "get_room_detail", { target_room_slug: tabarniaSlug })).length ===
        0,
      "Manuel no puede abrir Tabarnia",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "El seed no crea partidas",
    );

    const attemptId = "00000000-0000-4000-8000-00000000be7a";
    await dockerSql(
      `
begin;
insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, kind, status,
   client_state_schema_version)
values
  ('${attemptId}', '${fixture.users.ches.playerId}', '${alphabet.id}',
   '${alphabet.challengeVersionId}', 'competitive', 'in_progress', 1);
update public.attempts
set status = 'completed', completed_at = clock_timestamp(), score = 40,
    lock_version = lock_version + 1
where id = '${attemptId}';
insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
values
  ('${beta.seasonId}', '${fixture.users.ches.playerId}', '${alphabet.id}',
   '${attemptId}', 'accreditation', 40, 'betavip-integration-score');
commit;
`,
      config.dbContainer,
    );

    const betaRanking = await rpc(clients.ches, "get_season_ranking", {
      target_season_id: beta.seasonId,
    });
    const tabarniaRanking = await rpc(clients.ches, "get_season_ranking", {
      target_season_id: beta.tabarnia.seasonId,
    });
    assert(
      betaRanking.find((row) => row.player_id === fixture.users.ches.playerId)?.flash_points === 40,
      "La puntuación del Alphabet de Ches pertenece a BetaVIP",
    );
    assert(
      tabarniaRanking.find((row) => row.player_id === fixture.users.ches.playerId)?.flash_points ===
        0,
      "La puntuación de BetaVIP no se suma a Tabarnia",
    );
    assert(
      (
        await rpc(clients.ches, "get_challenge_ranking", {
          target_publication_id: alphabet.id,
        })
      ).length === 1,
      "La partida figura en el Alphabet de BetaVIP",
    );
    assert(
      (
        await rpc(clients.ches, "get_challenge_ranking", {
          target_publication_id: steel.id,
        })
      ).length === 0,
      "Steel Ball Run de BetaVIP no recibe la partida del Alphabet",
    );
    assert(
      (
        await rpc(clients.ches, "get_challenge_ranking", {
          target_publication_id: beta.tabarnia.steelBallRunPublicationId,
        })
      ).length === 0,
      "La publicación de Tabarnia no recibe la partida de BetaVIP",
    );
  },
};

export default scenario;
