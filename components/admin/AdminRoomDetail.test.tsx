import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminRoomDetail } from "./AdminRoomDetail";

const model = {
  operator: { playerId: "00000000-0000-4000-8000-000000000001", displayName: "Operador" },
  room: {
    roomId: "00000000-0000-4000-8000-000000000002",
    slug: "sala-beta",
    title: "Sala beta",
    timeZone: "Europe/Madrid",
    status: "active" as const,
    seasons: [
      {
        seasonId: "00000000-0000-4000-8000-000000000003",
        title: "Temporada activa",
        status: "active" as const,
        startsAt: "2026-09-20T10:00:00.000Z",
        endsAt: "2026-10-20T10:00:00.000Z",
      },
    ],
  },
  members: [
    {
      playerId: "00000000-0000-4000-8000-000000000004",
      displayName: "Jugador beta",
      email: "jugador@example.com",
      role: "member" as const,
      joinedAt: "2026-09-20T10:00:00.000Z",
    },
  ],
  calendar: { entries: [], source: "supabase" as const },
  publishedContent: [],
  source: "supabase" as const,
};

describe("AdminRoomDetail", () => {
  it("renders room context, active season and direct tabs", () => {
    const markup = renderToStaticMarkup(<AdminRoomDetail model={model} tab="overview" />);

    expect(markup).toContain("Sala beta");
    expect(markup).toContain("Temporada activa");
    expect(markup).toContain(
      'href="/admin/rooms/00000000-0000-4000-8000-000000000002?tab=seasons"',
    );
    expect(markup).toContain(
      'href="/admin/rooms/00000000-0000-4000-8000-000000000002?tab=members"',
    );
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Salas");
  });

  it("renders active members and a superadmin add-member form", () => {
    const markup = renderToStaticMarkup(<AdminRoomDetail model={model} tab="members" />);

    expect(markup).toContain("Usuarios activos");
    expect(markup).toContain("Jugador beta");
    expect(markup).toContain("jugador@example.com");
    expect(markup).toContain('name="role"');
    expect(markup).toContain("Añadir usuario a la sala");
    expect(markup).toContain("Motivo de auditoría");
  });
});
