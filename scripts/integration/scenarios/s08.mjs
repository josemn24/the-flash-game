export const scenario = {
  id: "s08",

  async run({ fixture, clients, assert }) {
    const input = {
      idempotencyKey: "integration-s08-create-room-1",
      title: fixture.data.title,
      description: "Sala creada desde el portal S08",
      timeZone: "Europe/Madrid",
      ownerEmail: fixture.data.ownerEmail,
      initialMembers: fixture.data.memberEmails,
      reason: "Preparación de la beta S08",
    };

    const lookup = await clients.superadmin.rpc("lookup_superadmin_players", {
      target_emails: [fixture.data.ownerEmail, ...fixture.data.memberEmails.map((member) => member.email)],
    });
    assert(!lookup.error && lookup.data?.length === 4, "El superadmin encuentra el grupo inicial");

    const created = await clients.superadmin.rpc("create_superadmin_room", { input });
    assert(!created.error, "El superadmin crea la sala privada");
    assert(created.data?.slug === "sala-s08-beta", "El slug se genera en el servidor");
    assert(created.data?.memberCount === 4, "La sala devuelve owner y grupo inicial");

    const repeated = await clients.superadmin.rpc("create_superadmin_room", { input });
    assert(!repeated.error && repeated.data?.roomId === created.data?.roomId, "La creación es idempotente");

    const ownerCards = await clients.owner.rpc("get_my_room_cards");
    const adminCards = await clients.admin.rpc("get_my_room_cards");
    const memberCards = await clients.member.rpc("get_my_room_cards");
    const spectatorCards = await clients.spectator.rpc("get_my_room_cards");
    assert(ownerCards.data?.some((room) => room.room_slug === created.data?.slug), "El owner ve la sala");
    assert(adminCards.data?.some((room) => room.room_slug === created.data?.slug), "El admin ve la sala");
    assert(memberCards.data?.some((room) => room.room_slug === created.data?.slug), "El member ve la sala");
    assert(spectatorCards.data?.some((room) => room.room_slug === created.data?.slug), "El spectator ve la sala");

    const outsiderCards = await clients.outsider.rpc("get_my_room_cards");
    assert(!outsiderCards.error && !outsiderCards.data?.some((room) => room.room_slug === created.data?.slug),
      "Un usuario externo no ve la sala");

    const duplicate = await clients.superadmin.rpc("create_superadmin_room", {
      input: { ...input, idempotencyKey: "integration-s08-create-room-2" },
    });
    assert(!duplicate.error && duplicate.data?.slug === "sala-s08-beta-2", "Las colisiones de slug se resuelven");
  },
};

export default scenario;
