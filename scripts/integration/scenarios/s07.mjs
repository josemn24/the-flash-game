import { rpc } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s07",

  async run({ fixture, clients, assert }) {
    const room = fixture.data.room.slug;
    const publications = fixture.data.publicationIds;
    const history = await rpc(clients.alice, "get_flash_history", {
      target_room_slug: room,
    });
    const publicationIds = [...new Set(history.map((row) => row.publication_id))];
    assert(publicationIds.length === 4, "El historial incluye solo publicaciones Flash cerradas elegibles");
    assert(
      !publicationIds.includes(publications.inProgress) && !publicationIds.includes(publications.cancelled),
      "Las publicaciones en curso o canceladas no aparecen",
    );
    assert(
      history.some((row) => row.publication_id === publications.empty && row.player_id === null),
      "Una publicación cerrada sin participantes conserva su entrada vacía",
    );
    const completed = history.filter((row) => row.publication_id === publications.completed);
    assert(
      completed.map((row) => row.position).filter(Boolean).join(",") === "1,1,3",
      "El ranking histórico conserva los empates 1, 1, 3",
    );
    assert(
      completed.every((row) => row.player_count === 3),
      "El conteo histórico usa jugadores competitivos distintos",
    );
    assert(
      history.some(
        (row) => row.publication_id === publications.abandoned && row.player_count === 1,
      ),
      "Los abandonos cuentan como participación histórica sin entrar en el ranking",
    );
    assert(
      history.some(
        (row) => row.publication_id === publications.archived && row.challenge_version_id === fixture.data.challengeVersionId,
      ),
      "La versión archivada sigue reconstruyendo el historial",
    );

    const selfCompleted = await rpc(clients.alice, "get_flash_member_review", {
      target_room_slug: room,
      target_publication_id: publications.completed,
      target_player_id: fixture.users.alice.playerId,
    });
    assert(selfCompleted.length === 2, "El jugador puede revisar su resultado completado");
    assert(
      JSON.stringify(selfCompleted).includes("S07_EXPLANATION_ONE"),
      "La revisión autorizada recibe las soluciones versionadas",
    );

    const peerAbandoned = await rpc(clients.alice, "get_flash_member_review", {
      target_room_slug: room,
      target_publication_id: publications.abandoned,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(peerAbandoned.length === 2, "Un miembro competitivo puede revisar un abandono ajeno");
    assert(
      peerAbandoned.some((row) => row.answer_status === null),
      "Los huecos no respondidos se mantienen como ausencia persistida",
    );

    const spectatorPeer = await rpc(clients.bob, "get_flash_member_review", {
      target_room_slug: room,
      target_publication_id: publications.completed,
      target_player_id: fixture.users.alice.playerId,
    });
    assert(spectatorPeer.length === 0, "El spectator no puede revisar respuestas ajenas");

    const spectatorHistory = await rpc(clients.bob, "get_flash_history", {
      target_room_slug: room,
    });
    assert(
      new Set(spectatorHistory.map((row) => row.publication_id)).size === publicationIds.length,
      "El spectator sí puede consultar el historial",
    );

    const missingRoom = await rpc(clients.alice, "get_flash_history", {
      target_room_slug: "s07-missing",
    });
    assert(missingRoom.length === 0, "Una sala inexistente no filtra historial");
  },
};

export default scenario;
