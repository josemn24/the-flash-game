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
  it("renders the room summary, daily challenge and both leaderboards", () => {
    const model = buildRoomDetailModel(demoRoom, now);
    const markup = renderToStaticMarkup(<FlashPopRoomDetail model={model} />);

    expect(markup).toContain("Tabarnia.");
    expect(markup).toContain("Mis gemas");
    expect(markup).toContain("136");
    expect(markup).toContain("#3");
    expect(markup).toContain("La Pirámide: Cumbre lógica");
    expect(markup).toContain("Jugar desafío");
    expect(markup).toContain('href="/desafios/tabarnia-challenge-05"');
    expect(markup).toContain("Ranking de sala");
    expect(markup).toContain("Puntos del desafío");
    expect(markup).toContain("Tú");
    expect(markup).toContain("Pendiente");
    expect(markup).toContain("--:--:--");
  });

  it("keeps the detail usable when no daily challenge exists", () => {
    const room = {
      ...demoRoom,
      activeSeason: { ...demoRoom.activeSeason, status: "finished" as const },
    };
    const markup = renderToStaticMarkup(
      <FlashPopRoomDetail model={buildRoomDetailModel(room, now)} />,
    );

    expect(markup).toContain("Sin reto hoy.");
    expect(markup).toContain("Sala activa");
    expect(markup).toContain("Ranking de sala");
    expect(markup).not.toContain("Jugar desafío");
    expect(markup).not.toContain("Termina en");
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
