import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "narrative",

  async run({ fixture, clients, config, assert }) {
    const playable = await rpc(clients.alice, "get_my_narrative_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe las dos preguntas narrativas");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,multiple-choice",
      "Narrative conserva el orden de sus preguntas",
    );
    assert(
      playable.every(
        (row) =>
          row.challenge_mode === "narrative" &&
          row.challenge_mode_config?.prologue &&
          Array.isArray(row.challenge_mode_config?.beats),
      ),
      "Narrative expone la configuración pública de escenas",
    );
    assert(
      !JSON.stringify(playable).includes("NARRATIVE_PRIVATE"),
      "La lectura narrativa no filtra soluciones privadas",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura narrativa no crea intentos",
    );
  },
};

export default scenario;
