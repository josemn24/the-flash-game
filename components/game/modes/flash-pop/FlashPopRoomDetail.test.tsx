import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomDetailModel } from "@/lib/roomDetail";
import { FlashPopRoomDetail } from "@/components/game/modes/flash-pop/FlashPopRoomDetail.client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const now = new Date("2026-09-06T12:00:00.000Z");

describe("FlashPopRoomDetail", () => {
  it("renders the compact room summary, daily challenge and daily leaderboard", () => {
    const model = buildRoomDetailModel(demoRoom, now);
    const markup = renderToStaticMarkup(<FlashPopRoomDetail model={model} />);

    expect(markup).toContain("Tabarnia");
    expect(markup).toContain("Gemas");
    expect(markup).toContain("136");
    expect(markup).toContain("#3");
    expect(markup).toContain("La Pirámide: Cumbre lógica");
    expect(markup).toContain("Jugar");
    expect(markup).toContain(
      'href="/desafios/tabarnia-challenge-05?roomId=tabarnia-room"',
    );
    expect(markup).toContain("Ranking de hoy");
    expect(markup).toContain('href="/salas/tabarnia-room/ranking"');
    expect(markup).toContain('href="/salas/tabarnia-room/historial"');
    expect(markup).toContain('href="/salas/tabarnia-room/ajustes"');
    expect(markup.match(/href="\/salas\/tabarnia-room\/ranking"/g)).toHaveLength(1);
    expect(markup).toContain(
      'aria-label="Abrir ajustes de Tabarnia"',
    );
    expect(markup).toContain("Tú");
    expect(markup).toContain("Pendiente");
    expect(markup).toContain("--:--:--");
    expect(markup).not.toContain("Primera temporada");
    expect(markup).not.toContain("En directo");
    expect(markup).not.toContain("El reto de hoy y las posiciones de tu sala.");
    expect(markup).not.toContain("Ranking de sala");
    expect(markup).not.toContain("Puntos acumulados");
  });

  it("keeps the detail usable when no daily challenge exists", () => {
    const room = {
      ...demoRoom,
      activeSeason: { ...demoRoom.activeSeason, status: "finished" as const },
    };
    const markup = renderToStaticMarkup(
      <FlashPopRoomDetail model={buildRoomDetailModel(room, now)} />,
    );

    expect(markup).toContain("Sin reto hoy");
    expect(markup).toContain('href="/salas/tabarnia-room/ranking"');
    expect(markup).toContain('href="/salas/tabarnia-room/historial"');
    expect(markup).not.toContain("Jugar");
    expect(markup).not.toContain("Tiempo restante");
    expect(markup).not.toContain("Ranking de hoy");
  });

  it("does not add the season calendar, chat or activity feed", () => {
    const markup = renderToStaticMarkup(
      <FlashPopRoomDetail model={buildRoomDetailModel(demoRoom, now)} />,
    );

    expect(markup).not.toContain("Calendario");
    expect(markup).not.toContain("Chat");
    expect(markup).not.toContain("Actividad reciente");
  });
});
