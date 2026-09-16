import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminPortal } from "./AdminPortal";

const baseContext = {
  operator: {
    playerId: "00000000-0000-4000-8000-000000000001",
    displayName: "Operador beta",
  },
  rooms: [
    {
      roomId: "00000000-0000-4000-8000-000000000002",
      slug: "portal-alpha",
      title: "Sala Alpha",
      timeZone: "Europe/Madrid",
      status: "active" as const,
      seasons: [
        {
          seasonId: "00000000-0000-4000-8000-000000000003",
          title: "Temporada Alpha",
          status: "draft" as const,
          startsAt: "2026-09-20T10:30:00.000Z",
          endsAt: "2026-09-27T10:30:00.000Z",
        },
      ],
    },
  ],
  source: "supabase" as const,
};

describe("AdminPortal", () => {
  it("renders the operator and static active-room cards", () => {
    const markup = renderToStaticMarkup(<AdminPortal context={baseContext} />);

    expect(markup).toContain("Portal de operaciones");
    expect(markup).toContain("Operador beta");
    expect(markup).toContain("Sala Alpha");
    expect(markup).toContain("/portal-alpha");
    expect(markup).toContain("Crear una sala privada");
    expect(markup).toContain("Temporadas");
    expect(markup).toContain("Temporada Alpha");
    expect(markup).toContain("Activar temporada");
    expect(markup).not.toContain('href="/admin');
  });

  it("renders an empty state without inventing administrative actions", () => {
    const markup = renderToStaticMarkup(<AdminPortal context={{ ...baseContext, rooms: [] }} />);

    expect(markup).toContain("Aún no hay salas activas.");
    expect(markup).toContain("0 salas");
    expect(markup).not.toContain("Invitar");
    expect(markup).not.toContain("Temporada");
  });
});
