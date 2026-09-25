export const scenario = {
  id: "portal",

  async run({ fixture, clients, assert }) {
    const { data, error } = await clients.superadmin.rpc("get_superadmin_portal_context");
    assert(!error, "El superadmin puede consultar el contexto del portal");
    assert(data?.operator?.displayName === "Operador beta", "El contexto identifica al operador");
    assert(data?.rooms?.length === fixture.data.activeRooms.length, "Se listan salas activas");
    assert(
      data.rooms.every((room) => room.status === "active"),
      "El contexto solo devuelve salas activas",
    );
    assert(
      !data.rooms.some((room) => room.slug === fixture.data.deletedRoom.slug),
      "Las salas eliminadas no aparecen",
    );

    const member = await clients.member.rpc("get_superadmin_portal_context");
    assert(member.error?.code === "42501", "Un miembro normal no puede consultar el portal");

    const directPrivateRead = await clients.member
      .from("private.platform_role_assignments")
      .select("player_id");
    assert(directPrivateRead.error, "La asignación de superadmin no se lee directamente");
  },
};

export default scenario;
