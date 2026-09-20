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
    const roomCards = await rpc(clients.ches, "get_my_room_cards", {});
    const memberPreviews = roomCards[0]?.member_previews ?? [];
    const darkPreview = memberPreviews.find((preview) => preview.name === "Dark");
    const jacoboPreview = memberPreviews.find((preview) => preview.name === "Jacobo");
    const chesPreview = memberPreviews.find((preview) => preview.name === "Ches");
    assert(darkPreview?.avatarPath?.startsWith("avatars/"), "Dark tiene avatar en Storage");
    assert(jacoboPreview?.avatarPath?.startsWith("avatars/"), "Jacobo tiene avatar en Storage");
    assert(!chesPreview?.avatarPath, "Ches conserva el fallback sin avatar");
    assert(
      (await sqlCount(
        "select count(*) from private.media_assets where bucket_id = 'avatars' and kind = 'avatar' and status = 'ready';",
        config.dbContainer,
      )) === 7,
      "Tabarnia tiene siete avatares listos en Storage",
    );
    assert(
      (await sqlCount(
        "select count(*) from public.players where display_name in ('xesmona', 'Ches', 'Carlos', 'Javi', 'Alejandro', 'Diego') and avatar_path is null;",
        config.dbContainer,
      )) === 6,
      "Los seis perfiles sin avatar conservan avatar_path nulo",
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
