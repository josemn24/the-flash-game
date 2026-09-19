import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "e05",

  async run({ fixture, clients, config, assert }) {
    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas de E05");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,queens",
      "E05 publica Queens en segunda posición",
    );
    assert(
      !JSON.stringify(playable).includes('"solution"'),
      "La lectura jugable no filtra la solución Queens",
    );
    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe la proyección competitiva");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de E05 no crea intentos",
    );
  },
};

export default scenario;
