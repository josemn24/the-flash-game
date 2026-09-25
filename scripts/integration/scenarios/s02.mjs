import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s02",

  async run({ fixture, clients, config, assert }) {
    const alice = clients.alice;
    const bob = clients.bob;
    const aliceCards = await rpc(alice, "get_my_room_cards");
    const aliceSlugs = new Set(aliceCards.map((row) => row.room_slug));
    assert(aliceCards.length === 3, "Alice ve sus tres membresías activas");
    assert(
      aliceSlugs.has("s02-main") && aliceSlugs.has("s02-no-season"),
      "Alice ve main y no-season",
    );
    assert(
      !aliceSlugs.has("s02-left") && !aliceSlugs.has("s02-other"),
      "Alice no ve abandonada ni externa",
    );

    const main = aliceCards.find((row) => row.room_slug === "s02-main");
    assert(main?.membership_role === "owner", "Alice es owner en la sala principal");
    assert(main?.challenge_max_score === 100, "La proyección devuelve el máximo permitido");
    assert(main?.question_count === 2, "La proyección devuelve solo el recuento de preguntas");
    assert(
      !JSON.stringify(main).includes("S02_PRIVATE"),
      "La tarjeta no filtra marcadores privados",
    );

    const unauthorized = await rpc(alice, "get_room_detail", { target_room_slug: "s02-other" });
    const missing = await rpc(alice, "get_room_detail", { target_room_slug: "s02-missing" });
    assert(
      unauthorized.length === 0 && missing.length === 0,
      "Ajena e inexistente tienen la misma ausencia",
    );

    const introduction = await rpc(alice, "get_room_introduction", {
      target_room_slug: "s02-main",
      target_publication_id: fixture.data.publicationId,
    });
    assert(introduction.length === 1, "Alice abre la introducción autorizada");
    assert(
      !JSON.stringify(introduction).includes("S02_PRIVATE"),
      "La introducción no filtra payload ni solución",
    );

    const spectatorRoom = await rpc(bob, "get_room_introduction", {
      target_room_slug: "s02-spectator",
      target_publication_id: fixture.data.spectatorPublicationId,
    });
    assert(spectatorRoom[0]?.membership_role === "spectator", "Bob conserva el rol spectator");
    assert(
      !JSON.stringify(spectatorRoom).includes("S02_PRIVATE"),
      "El espectador solo recibe metadatos",
    );

    const privateRead = await bob.from("private.question_versions").select("public_payload");
    assert(privateRead.error, "El cliente autenticado no lee tablas privadas");
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "La lectura no crea attempts",
    );
  },
};

export default scenario;
