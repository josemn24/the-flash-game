import { rpc } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s10",

  async run({ fixture, clients, assert }) {
    const startsAt = "2030-09-20T10:30:00.000Z";
    const endsAt = "2030-09-27T10:30:00.000Z";
    const createInput = {
      idempotencyKey: "integration-s10-create-1",
      roomId: fixture.data.roomId,
      title: "Temporada S10",
      startsAt,
      endsAt,
      reason: "Preparar S10",
    };

    const { data: initialContext, error: contextError } = await clients.superadmin.rpc(
      "get_superadmin_portal_context",
    );
    assert(!contextError && initialContext, "El contexto del portal está disponible");
    const initialRoom = initialContext.rooms.find((room) => room.roomId === fixture.data.roomId);
    assert(
      initialRoom?.timeZone === "Europe/Madrid",
      "El contexto del portal devuelve la zona de la sala",
    );
    assert(
      initialRoom?.seasons.some((season) => season.status === "finished"),
      "El contexto conserva la temporada anterior",
    );

    const created = await clients.superadmin.rpc("create_superadmin_season", {
      input: createInput,
    });
    assert(!created.error && created.data?.status === "draft", "El superadmin crea un borrador");
    assert(
      created.data?.roomId === fixture.data.roomId,
      "El borrador pertenece a la sala seleccionada",
    );

    const repeated = await clients.superadmin.rpc("create_superadmin_season", {
      input: createInput,
    });
    assert(
      !repeated.error && repeated.data?.seasonId === created.data?.seasonId,
      "La creación de temporada es idempotente",
    );

    const updated = await clients.superadmin.rpc("update_superadmin_season", {
      input: {
        idempotencyKey: "integration-s10-update-1",
        seasonId: created.data.seasonId,
        title: "Temporada S10 editada",
        startsAt,
        endsAt,
        reason: "Ajustar S10",
      },
    });
    assert(
      !updated.error && updated.data?.title === "Temporada S10 editada",
      "El superadmin edita el borrador",
    );

    const activated = await clients.superadmin.rpc("activate_superadmin_season", {
      input: {
        idempotencyKey: "integration-s10-activate-1",
        seasonId: created.data.seasonId,
        reason: "Abrir S10",
      },
    });
    assert(
      !activated.error && activated.data?.status === "active",
      "El superadmin activa una temporada futura",
    );

    const draft = await clients.superadmin.rpc("create_superadmin_season", {
      input: {
        ...createInput,
        idempotencyKey: "integration-s10-create-draft-2",
        title: "Borrador oculto S10",
      },
    });
    assert(!draft.error && draft.data?.status === "draft", "La sala puede preparar otro borrador");

    const memberSeasons = await clients.member
      .from("seasons")
      .select("id,title,status")
      .eq("room_id", fixture.data.roomId);
    assert(!memberSeasons.error, "El miembro puede consultar temporadas autorizadas");
    assert(
      memberSeasons.data?.some((season) => season.status === "active"),
      "El miembro ve la temporada activa",
    );
    assert(
      !memberSeasons.data?.some((season) => season.status === "draft"),
      "El miembro no ve borradores",
    );

    const memberCards = await rpc(clients.member, "get_my_room_cards");
    const memberRoom = memberCards.find((room) => room.room_slug === fixture.data.roomSlug);
    assert(
      memberRoom?.season_title === "Temporada S10 editada",
      "La sala pública refleja la temporada activa",
    );
    assert(memberRoom?.publication_id === null, "Activar la temporada no crea publicaciones");

    const outsiderCards = await rpc(clients.outsider, "get_my_room_cards");
    assert(
      !outsiderCards.some((room) => room.room_slug === fixture.data.roomSlug),
      "Un externo no ve la sala",
    );
  },
};

export default scenario;
