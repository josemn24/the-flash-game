import { rpc } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s06",

  async run({ fixture, clients, assert }) {
    const room = fixture.data.room.slug;
    const season = await rpc(clients.alice, "get_room_detail", {
      target_room_slug: room,
    });
    assert(season.length === 1, "Alice puede resolver la sala real");

    const seasonRanking = await rpc(clients.alice, "get_season_ranking", {
      target_season_id: season[0].season_id,
    });
    assert(seasonRanking.length === 3, "La temporada incluye a los tres competidores activos");
    assert(
      seasonRanking.every((row) => row.flash_points === 0 && row.position === 1),
      "Los competidores activos empiezan con cero puntos y comparten la posición 1",
    );
    assert(
      !seasonRanking.some((row) => row.player_id === fixture.users.bob.playerId),
      "El spectator no aparece en el ranking competitivo",
    );

    const challengeRanking = await rpc(clients.alice, "get_challenge_ranking", {
      target_publication_id: fixture.data.publicationId,
    });
    assert(challengeRanking.length === 0, "La publicación abierta sin resultados empieza vacía");

    const cards = await rpc(clients.alice, "get_my_room_cards");
    const card = cards.find((row) => row.room_id === fixture.data.room.id);
    const currentSeasonRow = seasonRanking.find(
      (row) => row.player_id === fixture.users.alice.playerId,
    );
    assert(
      card?.current_position === currentSeasonRow?.position,
      "La tarjeta de sala reutiliza la posición del ranking de temporada",
    );

    const spectatorRanking = await rpc(clients.bob, "get_season_ranking", {
      target_season_id: season[0].season_id,
    });
    assert(
      spectatorRanking.length === seasonRanking.length,
      "El spectator puede consultar la temporada",
    );
    const spectatorChallengeRanking = await rpc(clients.bob, "get_challenge_ranking", {
      target_publication_id: fixture.data.publicationId,
    });
    assert(
      spectatorChallengeRanking.length === challengeRanking.length,
      "El spectator puede consultar la publicación abierta",
    );

    const missing = await rpc(clients.alice, "get_season_ranking", {
      target_season_id: "00000000-0000-0000-0000-000000000099",
    });
    assert(missing.length === 0, "Una temporada inaccesible no filtra datos");
  },
};

export default scenario;
