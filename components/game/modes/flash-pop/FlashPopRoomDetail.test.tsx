import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockQueryContext, mockRoomQueries } from "@/test-utils/mockRoom";
import { FlashPopRoomDetail } from "@/components/game/modes/flash-pop/FlashPopRoomDetail.client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const now = new Date("2026-09-06T12:00:00.000Z");

async function getRoomDetailModel() {
  const model = await mockRoomQueries.getDetail("tabarnia-room", mockQueryContext(now));
  if (!model) throw new Error("Expected room detail model");
  return model;
}

describe("FlashPopRoomDetail", () => {
  it("renders the compact room summary, daily challenge and daily leaderboard", async () => {
    const model = await getRoomDetailModel();
    const markup = renderToStaticMarkup(<FlashPopRoomDetail model={model} />);

    expect(markup).toContain("Tabarnia");
    expect(markup).toContain("Flash Points");
    expect(markup).toContain("169");
    expect(markup).toContain("#3");
    expect(markup).toContain("Biblia y religiones abrahámicas");
    expect(markup).toContain("La Pirámide");
    expect(markup).not.toContain("7 preguntas");
    expect(markup).toContain("Jugar");
    expect(markup).toContain('href="/desafios/tabarnia-challenge-06?roomId=tabarnia-room"');
    expect(markup).toContain("Ranking de hoy");
    expect(markup).not.toContain(">Flash points<");
    expect(markup).toContain('href="/salas/tabarnia-room/ranking"');
    expect(markup).toContain('href="/salas/tabarnia-room/historial"');
    expect(markup).toContain('href="/salas/tabarnia-room/ajustes"');
    expect(markup.match(/href="\/salas\/tabarnia-room\/ranking"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Abrir ajustes de Tabarnia"');
    expect(markup).toContain("Todavía no ha jugado nadie.");
    expect(markup).toContain("5 pendientes por jugar");
    expect(markup).toContain("--:--:--");
    expect(markup).not.toContain("Primera temporada");
    expect(markup).not.toContain("En directo");
    expect(markup).not.toContain("El reto de hoy y las posiciones de tu sala.");
    expect(markup).not.toContain("Ranking de sala");
    expect(markup).not.toContain("Puntos acumulados");
  });

  it("keeps the detail usable when no daily challenge exists", async () => {
    const model = await getRoomDetailModel();
    const markup = renderToStaticMarkup(
      <FlashPopRoomDetail model={{ ...model, dailyChallenge: null, dailyLeaderboard: [] }} />,
    );

    expect(markup).toContain("Sin reto hoy");
    expect(markup).toContain('href="/salas/tabarnia-room/ranking"');
    expect(markup).toContain('href="/salas/tabarnia-room/historial"');
    expect(markup).not.toContain("Jugar");
    expect(markup).not.toContain("Tiempo restante");
    expect(markup).toContain("Ranking de hoy");
    expect(markup).toContain("Sin reto disponible hoy.");
    expect(markup).not.toContain("pendientes por jugar");
  });

  it("does not add the season calendar, chat or activity feed", async () => {
    const model = await getRoomDetailModel();
    const markup = renderToStaticMarkup(<FlashPopRoomDetail model={model} />);

    expect(markup).not.toContain("Calendario");
    expect(markup).not.toContain("Chat");
    expect(markup).not.toContain("Actividad reciente");
  });

  it("renders the persisted calendar states and only links playable entries", async () => {
    const model = await getRoomDetailModel();
    const markup = renderToStaticMarkup(
      <FlashPopRoomDetail
        model={{
          ...model,
          source: "supabase",
          calendar: [
            {
              id: "future-1",
              number: 1,
              timeZone: "Europe/Madrid",
              status: "scheduled",
              availabilityStatus: "upcoming",
              opensAt: "2026-09-20T10:00:00.000Z",
              closesAt: "2026-09-20T11:00:00.000Z",
              title: "Flash futuro",
              subtitle: null,
              mode: "flash",
              questionCount: 2,
              href: "/desafios/future-1?roomId=tabarnia-room",
              canStart: false,
              canContinue: false,
            },
            {
              id: "open-2",
              number: 2,
              timeZone: "Europe/Madrid",
              status: "open",
              availabilityStatus: "available",
              opensAt: "2026-09-19T10:00:00.000Z",
              closesAt: "2026-09-19T11:00:00.000Z",
              title: "Flash abierto",
              subtitle: null,
              mode: "flash",
              questionCount: 2,
              href: "/desafios/open-2?roomId=tabarnia-room",
              canStart: true,
              canContinue: false,
            },
            {
              id: "closed-3",
              number: 3,
              timeZone: "Europe/Madrid",
              status: "closed",
              availabilityStatus: "closed",
              opensAt: "2026-09-18T10:00:00.000Z",
              closesAt: "2026-09-18T11:00:00.000Z",
              title: "Flash cerrado",
              subtitle: null,
              mode: "flash",
              questionCount: 2,
              href: "/desafios/closed-3?roomId=tabarnia-room",
              canStart: false,
              canContinue: false,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain("Desafíos de la temporada");
    expect(markup).toContain("Próximo");
    expect(markup).toContain("Disponible");
    expect(markup).toContain("Cerrado");
    expect(markup).toContain('href="/desafios/open-2?roomId=tabarnia-room"');
    expect(markup).not.toContain('href="/desafios/future-1?roomId=tabarnia-room"');
    expect(markup).not.toContain('href="/desafios/closed-3?roomId=tabarnia-room"');
    expect(markup).toContain("Europe/Madrid");
  });

  it.each([
    ["available", "Pendiente", "Jugar", "/desafios/tabarnia-challenge-06?roomId=tabarnia-room"],
    [
      "inProgress",
      "En progreso",
      "Continuar",
      "/desafios/tabarnia-challenge-06?roomId=tabarnia-room",
    ],
    ["completed", "Completado", "Ver resultado", "/salas/tabarnia-room/ranking/player"],
    ["notCompleted", "No completado", "Ver resultado", "/salas/tabarnia-room/ranking/player"],
  ] as const)(
    "uses the %s label and action for the current attempt",
    async (status, statusLabel, label, href) => {
      const model = await getRoomDetailModel();
      const markup = renderToStaticMarkup(
        <FlashPopRoomDetail
          model={{
            ...model,
            currentUser: { ...model.currentUser, dailyAttemptStatus: status },
          }}
        />,
      );

      expect(markup).toContain(statusLabel);
      expect(markup).toContain(label);
      expect(markup).toContain(`href="${href}"`);
    },
  );
});
