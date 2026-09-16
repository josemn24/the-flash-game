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
      status: "active" as const,
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
    expect(markup).not.toContain("Crear sala");
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
