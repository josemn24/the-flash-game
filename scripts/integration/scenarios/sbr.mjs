import { rpc } from "../../support/supabase-local.mjs";

const expectedTypes = [
  "multiple-choice",
  "odd-one-out",
  "matching",
  "ordering",
  "progressive-image",
  "heat-map",
  "estimation",
  "classification",
  "anagram",
  "multiple-choice",
  "true-false",
  "multiple-choice",
  "ordering",
  "multiple-choice",
  "true-false",
  "multiple-choice",
];

export const scenario = {
  id: "sbr",
  async run({ fixture, clients, assert }) {
    const playable = await rpc(clients.owner, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 16, "owner recibe las 16 preguntas SBR");
    assert(
      playable.map((row) => row.question_type).join(",") === expectedTypes.join(","),
      "SBR conserva el orden y los formatos del mock publicado",
    );
    assert(
      playable.reduce((total, row) => total + Number(row.item_points), 0) === 100,
      "SBR conserva los 100 puntos del desafío",
    );
    const serialized = JSON.stringify(playable);
    assert(
      !serialized.includes("correctAnswer"),
      "La lectura inicial no expone respuestas correctas",
    );
    assert(!serialized.includes("solutionPayload"), "La lectura inicial no expone solutionPayload");

    const spectator = await rpc(clients.spectator, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe el desafío competitivo SBR");
  },
};

export default scenario;
