import { rpc } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s07",

  async run({ fixture, clients, assert }) {
    const room = fixture.data.room.slug;
    const publications = fixture.data.publicationIds;
    const history = await rpc(clients.alice, "get_room_history", {
      target_room_slug: room,
    });
    const publicationIds = [...new Set(history.map((row) => row.publication_id))];
    assert(
      publicationIds.length === 8,
      "El historial mixto incluye publicaciones cerradas elegibles",
    );
    assert(
      new Set(history.map((row) => row.challenge_mode)).size === 5,
      "El historial mixto incluye los cinco modos",
    );
    assert(
      history.every((row) => row.publication_status === "closed"),
      "La proyección normaliza el cierre efectivo sin ejecutar el tick",
    );
    assert(
      !JSON.stringify(history).includes("S07_ALPHABET_EXPLANATION"),
      "El historial no expone soluciones",
    );
    assert(
      !publicationIds.includes(publications.inProgress) &&
        !publicationIds.includes(publications.cancelled),
      "Las publicaciones en curso o canceladas no aparecen",
    );
    assert(
      history.some((row) => row.publication_id === publications.empty && row.player_id === null),
      "Una publicación cerrada sin participantes conserva su entrada vacía",
    );
    const completed = history.filter((row) => row.publication_id === publications.completed);
    assert(
      completed
        .map((row) => row.position)
        .filter(Boolean)
        .join(",") === "1,1,3",
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
        (row) =>
          row.publication_id === publications.archived &&
          row.challenge_version_id === fixture.data.challengeVersionId,
      ),
      "La versión archivada sigue reconstruyendo el historial",
    );

    const selfCompleted = await rpc(clients.alice, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.completed,
      target_player_id: fixture.users.alice.playerId,
    });
    assert(selfCompleted.length === 2, "El jugador puede revisar su resultado completado");
    assert(
      JSON.stringify(selfCompleted).includes("S07_EXPLANATION_ONE"),
      "La revisión autorizada recibe las soluciones versionadas",
    );

    const alphabetReview = await rpc(clients.alice, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.alphabet,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(
      alphabetReview.map((row) => row.alphabet_letter).join(",") === "B,A,Ñ,Z",
      "Alfabeto conserva todas las letras y su orden original",
    );
    assert(
      alphabetReview.every(
        (row) =>
          row.global_time_limit_ms === 90000 &&
          row.question_type === "short-text" &&
          row.publication_status === "closed",
      ),
      "La revisión de Alfabeto conserva el tiempo global y normaliza scheduled a closed",
    );
    assert(
      alphabetReview.map((row) => row.answer_status ?? "absent").join(",") ===
        "correct,incorrect,timeout,absent",
      "La revisión incluye aciertos, errores, agotados y letras ausentes",
    );
    const alphabetAbandoned = await rpc(clients.alice, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.alphabet,
      target_player_id: fixture.users.alice.playerId,
    });
    assert(
      alphabetAbandoned.length === 4 &&
        alphabetAbandoned.every(
          (row) => row.attempt_status === "abandoned" && !row.has_persisted_answer,
        ),
      "Un abandono de Alfabeto conserva todas las letras sin responder",
    );
    const alphabetRanking = history.filter((row) => row.publication_id === publications.alphabet);
    assert(
      alphabetRanking.length === 1 &&
        alphabetRanking[0].flash_points === 25 &&
        alphabetRanking[0].player_count === 2,
      "Alfabeto reutiliza puntos efectivos y cuenta los abandonos",
    );
    const narrativeReview = await rpc(clients.alice, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.narrative,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(narrativeReview.length === 2, "Narrativa conserva su revisión común");

    const survivalReview = await rpc(clients.alice, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.survival,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(survivalReview.length === 1, "Supervivencia solo expone las preguntas alcanzadas");
    assert(
      survivalReview[0].attempt_outcome === "passed",
      "La revisión de Supervivencia conserva el outcome persistido",
    );

    const pyramidReview = await rpc(clients.alice, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.pyramid,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(pyramidReview.length === 7, "Pirámide conserva sus siete niveles históricos");
    assert(
      pyramidReview.filter((row) => row.has_persisted_answer === false).length === 5,
      "Los niveles de Pirámide no alcanzados permanecen bloqueados",
    );
    assert(
      pyramidReview.filter(
        (row) => row.public_payload === null && row.has_persisted_answer === false,
      ).length === 5,
      "Los niveles bloqueados no exponen payload público",
    );

    const peerAbandoned = await rpc(clients.alice, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.abandoned,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(peerAbandoned.length === 2, "Un miembro competitivo puede revisar un abandono ajeno");
    assert(
      peerAbandoned.some((row) => row.answer_status === null),
      "Los huecos no respondidos se mantienen como ausencia persistida",
    );

    const spectatorPeer = await rpc(clients.bob, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.completed,
      target_player_id: fixture.users.alice.playerId,
    });
    assert(spectatorPeer.length === 0, "El spectator no puede revisar respuestas ajenas");
    const spectatorAlphabet = await rpc(clients.bob, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.alphabet,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(
      spectatorAlphabet.length === 0,
      "El spectator tampoco puede revisar Alfabeto por URL directa",
    );
    const spectatorPyramid = await rpc(clients.bob, "get_room_member_review", {
      target_room_slug: room,
      target_publication_id: publications.pyramid,
      target_player_id: fixture.users.carol.playerId,
    });
    assert(
      spectatorPyramid.length === 0,
      "El spectator tampoco puede revisar Pirámide por URL directa",
    );

    const spectatorHistory = await rpc(clients.bob, "get_room_history", {
      target_room_slug: room,
    });
    assert(
      new Set(spectatorHistory.map((row) => row.publication_id)).size === publicationIds.length,
      "El spectator sí puede consultar el historial",
    );

    const missingRoom = await rpc(clients.alice, "get_room_history", {
      target_room_slug: "s07-missing",
    });
    assert(missingRoom.length === 0, "Una sala inexistente no filtra historial");
  },
};

export default scenario;
