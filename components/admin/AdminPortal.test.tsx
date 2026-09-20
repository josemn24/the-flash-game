import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDashboard } from "./AdminDashboard";

const baseModel = {
  operator: {
    playerId: "00000000-0000-4000-8000-000000000001",
    displayName: "Operador beta",
  },
  metrics: {
    activeRooms: 1,
    activeSeasons: 1,
    pendingSeasons: 2,
    editorialDrafts: 1,
    upcomingChallenges: 1,
  },
  rooms: [
    {
      roomId: "00000000-0000-4000-8000-000000000002",
      slug: "portal-alpha",
      title: "Sala Alpha",
      timeZone: "Europe/Madrid",
      status: "active" as const,
      seasonCount: 1,
      activeSeason: {
        title: "Temporada Alpha",
        startsAt: "2026-09-20T10:30:00.000Z",
        endsAt: "2026-09-27T10:30:00.000Z",
      },
    },
  ],
  upcomingChallenges: [
    {
      scheduledChallengeId: "00000000-0000-4000-8000-000000000004",
      roomId: "00000000-0000-4000-8000-000000000002",
      roomTitle: "Sala Alpha",
      seasonId: "00000000-0000-4000-8000-000000000003",
      seasonTitle: "Temporada Alpha",
      challengeVersionId: "00000000-0000-4000-8000-000000000005",
      challengeTitle: "Flash de prueba",
      number: 1,
      status: "scheduled" as const,
      opensAt: "2026-09-21T10:30:00.000Z",
      closesAt: "2026-09-21T11:30:00.000Z",
      timeZone: "Europe/Madrid",
    },
  ],
  alerts: [],
  actions: [
    { id: "create-room", label: "Crear sala", href: "/admin/rooms" },
    { id: "prepare-season", label: "Preparar temporada", href: "/admin/rooms" },
    { id: "edit-content", label: "Preparar contenido", href: "/admin/content" },
    { id: "schedule-challenge", label: "Programar desafío", href: "/admin/rooms" },
  ],
  source: "supabase" as const,
};

describe("AdminDashboard", () => {
  it("renders summary data and direct operational links", () => {
    const markup = renderToStaticMarkup(<AdminDashboard model={baseModel} />);

    expect(markup).toContain("Portal de operaciones");
    expect(markup).toContain("Operador beta");
    expect(markup).toContain("Sala Alpha");
    expect(markup).toContain("/portal-alpha");
    expect(markup).toContain("Temporada Alpha");
    expect(markup).toContain("Flash de prueba");
    expect(markup).toContain('href="/admin/rooms"');
    expect(markup).toContain('href="/admin/content"');
    expect(markup).not.toContain('href="/admin/seasons"');
    expect(markup).not.toContain('href="/admin/calendar"');
    expect(markup).not.toContain("Crear una sala privada");
    expect(markup).not.toContain("Guardar borrador");
    expect(markup).not.toContain("Solución privada");
  });

  it("renders empty operational states without inventing forms", () => {
    const markup = renderToStaticMarkup(
      <AdminDashboard
        model={{
          ...baseModel,
          metrics: {
            activeRooms: 0,
            activeSeasons: 0,
            pendingSeasons: 0,
            editorialDrafts: 0,
            upcomingChallenges: 0,
          },
          rooms: [],
          upcomingChallenges: [],
        }}
      />,
    );

    expect(markup).toContain("Aún no hay salas activas.");
    expect(markup).toContain("No hay desafíos próximos.");
    expect(markup).toContain("No hay alertas operativas.");
    expect(markup).not.toContain("Crear una sala privada");
  });
});
