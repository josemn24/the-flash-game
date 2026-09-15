import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s04",

  async run({ fixture, clients, config, assert }) {
    const alice = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(alice.length === 2, "Alice recibe las dos preguntas del Flash S04");
    assert(
      alice.every((row) => row.item_points === 50 && row.question_type === "multiple-choice"),
      "Cada pregunta es multiple-choice y vale 50 puntos",
    );
    assert(
      !JSON.stringify(alice).includes("S04_EXPLANATION") &&
        !JSON.stringify(alice).includes("correctAnswer"),
      "La lectura jugable no filtra las soluciones",
    );

    const spectator = await rpc(clients.bob, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(spectator.length === 0, "El spectator no recibe acceso competitivo");

    const missing = await rpc(clients.alice, "get_my_flash_challenge", {
      target_room_slug: "s04-missing",
      target_publication_id: fixture.data.publicationId,
    });
    assert(missing.length === 0, "La sala inexistente mantiene ausencia indistinguible");

    const privateRead = await clients.bob
      .from("private.question_versions")
      .select("public_payload");
    assert(privateRead.error, "El cliente autenticado no lee tablas privadas");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "El fixture empieza sin intentos para que el E2E controle el estado",
    );
  },
};

export default scenario;
