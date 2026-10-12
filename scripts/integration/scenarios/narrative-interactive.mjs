import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "narrative-interactive",

  async run({ fixture, clients, config, assert }) {
    const playable = await rpc(clients.alice, "get_my_narrative_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas del narrative interactivo");
    assert(
      playable.map((row) => row.question_type).join(",") === "queens,progressive-clues",
      "Narrative interactivo conserva el orden de sus formatos",
    );
    assert(
      playable.every(
        (row) =>
          row.challenge_mode === "narrative" &&
          row.challenge_mode_config?.prologue &&
          Array.isArray(row.challenge_mode_config?.beats),
      ),
      "Narrative interactivo expone la configuración pública de escenas",
    );
    assert(
      !JSON.stringify(playable).includes("Caída del muro de Berlín") &&
        !JSON.stringify(playable).includes("muro de berlin"),
      "La lectura narrativa no filtra la solución progressive-clues",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura narrativa interactiva no crea intentos",
    );
  },
};

export default scenario;
