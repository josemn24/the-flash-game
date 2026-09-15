import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s03",

  async run({ fixture, clients, config, assert }) {
    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas públicas");
    assert(
      playable[0]?.item_points === 50 && playable[1]?.item_points === 50,
      "Cada pregunta vale 50 puntos",
    );
    assert(
      playable.every((row) => row.question_type === "multiple-choice"),
      "El fixture usa solo multiple-choice",
    );
    assert(
      !JSON.stringify(playable).includes("correctAnswer") &&
        !JSON.stringify(playable).includes("explanation"),
      "La partida no recibe soluciones ni explicaciones",
    );

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El espectador no recibe la proyección competitiva");

    const missing = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: "s03-missing",
      target_publication_id: fixture.data.publicationId,
    });
    assert(missing.length === 0, "La sala inexistente tiene ausencia indistinguible");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "Las lecturas no crean intentos",
    );
  },
};

export default scenario;
