import { rpc } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "e10",
  async run({ fixture, clients, assert }) {
    const playable = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 2, "Alice recibe el desafío E10 mixto");
    assert(
      playable.map((row) => row.question_type).join(",") === "multiple-choice,progressive-image",
      "E10 conserva la imagen progresiva en segunda posición",
    );
    assert(
      !JSON.stringify(playable).includes("eiffel-tower") &&
        !JSON.stringify(playable).includes("acceptedAnswers"),
      "La lectura inicial no expone el asset ni la solución",
    );
    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe el desafío competitivo E10");
  },
};

export default scenario;
