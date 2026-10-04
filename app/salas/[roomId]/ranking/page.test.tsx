import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FlashPopRoomRanking } from "@/components/game/production";
import { DEMO_REFERENCE_TIME } from "@/data/mock/constants";
import { mockQueryContext, mockRoomReadCapabilities } from "@/test-utils/mockRoom";

const mocks = vi.hoisted(() => ({
  getRoomRankingPageModel: vi.fn(),
}));

vi.mock("@/server/production-room-data-access", () => mocks);

import RoomRankingPage, { dynamic, generateMetadata } from "./page";

describe("room ranking route", () => {
  it("exposes Tabarnia and renders accumulated points", async () => {
    const context = mockQueryContext(new Date(DEMO_REFERENCE_TIME));
    expect(dynamic).toBe("force-dynamic");
    mocks.getRoomRankingPageModel.mockResolvedValue(
      await mockRoomReadCapabilities.getRanking("tabarnia-room", context),
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Ranking de temporada de Tabarnia — The Flash",
    });

    const model = await mockRoomReadCapabilities.getRanking("tabarnia-room", context);
    if (!model) throw new Error("Expected ranking model");
    const markup = renderToStaticMarkup(<FlashPopRoomRanking {...model} />);

    expect(markup).toContain("Ranking de temporada");
    expect(markup).toContain("En curso");
    expect(markup).toContain("Dark");
    expect(markup).toContain("Jackobo");
    expect(markup).toContain("Rielbe");
    expect(markup).toContain("Palmera");
    expect(markup).toContain("242");
    expect(markup).toContain("Kike");
    expect(markup).not.toContain(">Tú<");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).not.toContain("Ranking de hoy");
    expect(markup).not.toContain("Clasificación de la sala");
    expect(markup).toContain('aria-label="242 Flash Points"');
  });

  it("renders a final classification after the season closes", async () => {
    const model = await mockRoomReadCapabilities.getRanking("tabarnia-room", mockQueryContext());
    if (!model?.season) throw new Error("Expected a season");
    mocks.getRoomRankingPageModel.mockResolvedValue({
      ...model,
      season: { ...model.season, status: "finished" },
    });

    const params = Promise.resolve({ roomId: "tabarnia-room" });
    const markup = renderToStaticMarkup(await RoomRankingPage({ params }));
    expect(markup).toContain("Clasificación final");
    expect(markup).toContain(model.season.title);
    expect(markup).toContain("Finalizada");
    expect(markup).toContain('aria-label="242 Flash Points"');
    await expect(generateMetadata({ params })).resolves.toMatchObject({
      title: "Clasificación final de Tabarnia — The Flash",
    });
  });

  it("shows a completed season without results as an empty classification", () => {
    const markup = renderToStaticMarkup(
      <FlashPopRoomRanking
        roomId="tabarnia-room"
        roomTitle="Tabarnia"
        currentUserId="player"
        season={{ id: "season", title: "Temporada Alpha", status: "finished" }}
        entries={[]}
      />,
    );
    expect(markup).toContain("Clasificación final");
    expect(markup).toContain("Esta temporada no tiene resultados.");
    expect(markup).not.toContain("Sin reto disponible hoy.");
  });

  it("keeps an accessible room without seasons out of the not-found state", async () => {
    mocks.getRoomRankingPageModel.mockResolvedValue({
      roomId: "tabarnia-room",
      roomTitle: "Tabarnia",
      currentUserId: "player",
      season: null,
      entries: [],
    });
    const markup = renderToStaticMarkup(
      await RoomRankingPage({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    );
    expect(markup).toContain("Todavía no hay una temporada disponible.");
    expect(markup).toContain('href="/salas/tabarnia-room"');
  });

  it("allows metadata to finish while the page forwards a read error to the retry boundary", async () => {
    mocks.getRoomRankingPageModel.mockRejectedValue(new Error("Ranking unavailable"));
    const params = Promise.resolve({ roomId: "tabarnia-room" });
    await expect(generateMetadata({ params })).resolves.toMatchObject({
      title: "Ranking — The Flash",
    });
    await expect(RoomRankingPage({ params })).rejects.toThrow("Ranking unavailable");
  });
});
