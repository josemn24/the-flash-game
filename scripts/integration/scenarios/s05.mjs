import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s05",

  async run({ fixture, clients, config, assert }) {
    const playable = await rpc(clients.alice, "get_my_alphabet_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 3, "Alice recibe las tres letras de S05");
    assert(
      playable.map((row) => row.alphabet_letter).join(",") === "A,B,C",
      "S05 conserva el orden de las letras",
    );
    assert(
      playable.every(
        (row) =>
          row.challenge_mode === "alphabet" &&
          row.question_type === "short-text" &&
          row.global_time_limit_ms === 20000,
      ),
      "S05 conserva el contrato público de Alphabet",
    );
    assert(
      !JSON.stringify(playable).includes("armadillo") &&
        !JSON.stringify(playable).includes("Brasil") &&
        !JSON.stringify(playable).includes("Canberra"),
      "La lectura de Alphabet no filtra soluciones",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura de S05 no crea intentos",
    );
  },
};

export default scenario;
