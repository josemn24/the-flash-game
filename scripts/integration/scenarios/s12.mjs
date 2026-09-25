import { dockerSql, rpc } from "../../support/supabase-local.mjs";

export const scenario = {
  id: "s12",

  async run({ fixture, clients, config, assert }) {
    const nowOpen = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s12-create-open",
        seasonId: fixture.data.seasonId,
        challengeVersionId: fixture.data.challengeVersionId,
        number: 1,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        reason: "Abrir S12",
      },
    });
    assert(!nowOpen.error && nowOpen.data?.status === "scheduled", "El superadmin programa una publicación");
    const repeated = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s12-create-open",
        seasonId: fixture.data.seasonId,
        challengeVersionId: fixture.data.challengeVersionId,
        number: 1,
        opensAt: nowOpen.data.opensAt,
        closesAt: nowOpen.data.closesAt,
        reason: "Abrir S12",
      },
    });
    assert(!repeated.error && repeated.data?.scheduledChallengeId === nowOpen.data?.scheduledChallengeId, "La programación es idempotente");

    const future = await clients.superadmin.rpc("create_superadmin_scheduled_challenge", {
      input: {
        idempotencyKey: "integration-s12-create-future",
        seasonId: fixture.data.seasonId,
        challengeVersionId: fixture.data.challengeVersionId,
        number: 2,
        opensAt: new Date(Date.now() + 86_400_000).toISOString(),
        closesAt: new Date(Date.now() + 90_000_000).toISOString(),
        reason: "Preparar futuro S12",
      },
    });
    assert(!future.error && future.data?.status === "scheduled", "El calendario conserva una publicación futura");
    const context = await clients.superadmin.rpc("get_superadmin_calendar_context");
    assert(!context.error && context.data?.entries?.length === 2, "El superadmin ve el contexto de calendario");

    const tickSql = `set role service_role; select private.run_calendar_tick_command(jsonb_build_object('runId','integration-s12-tick'));`;
    await dockerSql(tickSql, config.dbContainer);
    const calendar = await rpc(clients.member, "get_room_calendar", { target_room_slug: fixture.data.roomSlug });
    assert(calendar.length === 2, "El miembro ve futuro y disponible en el calendario");
    assert(calendar.find((entry) => entry.publication_number === 1)?.availability_status === "available", "La publicación abierta es jugable por reloj efectivo");
    assert(!JSON.stringify(calendar).includes("correctAnswer"), "La lectura pública nunca entrega soluciones");

    const spectator = await rpc(clients.spectator, "get_room_calendar", { target_room_slug: fixture.data.roomSlug });
    assert(spectator.length === 2 && spectator.every((entry) => !entry.can_start), "El espectador ve metadatos sin inicio competitivo");

    const memberCards = await rpc(clients.member, "get_my_room_cards");
    assert(memberCards.some((room) => room.room_slug === fixture.data.roomSlug), "La sala sigue disponible para el miembro");
    const outsider = await rpc(clients.outsider, "get_room_calendar", { target_room_slug: fixture.data.roomSlug });
    assert(outsider.length === 0, "Un externo no ve el calendario");
  },
};

export default scenario;
