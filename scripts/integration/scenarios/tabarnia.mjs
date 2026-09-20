import { rpc, sqlCount } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "tabarnia",

  async run({ fixture, clients, config, assert }) {
    const playable = await rpc(clients.ches, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(playable.length === 16, "Ches recibe las 16 preguntas de Steel Ball Run");
    assert(
      playable.reduce((total, row) => total + Number(row.item_points), 0) === 100,
      "Steel Ball Run conserva los 100 puntos",
    );
    assert(
      !JSON.stringify(playable).includes("correctAnswer") &&
        !JSON.stringify(playable).includes("solutionPayload"),
      "La lectura jugable no expone las soluciones",
    );
    assert(
      (await sqlCount(
        "select count(*) from public.room_memberships rm join public.rooms r on r.id = rm.room_id where r.slug = 'tabarnia' and rm.status = 'active';",
        config.dbContainer,
      )) === 12,
      "Tabarnia tiene 12 jugadores activos",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "El seed no crea intentos históricos",
    );

    const superadminView = await rpc(clients.xesmona, "get_my_flash_challenge", {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    });
    assert(superadminView.length === 0, "xesmona queda fuera de la competición");
  },
};

export default scenario;
