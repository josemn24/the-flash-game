import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FlashPopRoomRanking } from "@/components/game/production";
import { mockQueryContext, mockRoomReadCapabilities } from "@/test-utils/mockRoom";

const mocks = vi.hoisted(() => ({
  getRoomRankingPageModel: vi.fn(),
}));

vi.mock("@/server/production-room-data-access", () => mocks);

import { dynamic, generateMetadata } from "./page";

describe("room ranking route", () => {
  it("exposes Tabarnia and renders accumulated points", async () => {
    expect(dynamic).toBe("force-dynamic");
    mocks.getRoomRankingPageModel.mockResolvedValue(
      await mockRoomReadCapabilities.getRanking("tabarnia-room", mockQueryContext()),
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Ranking de Tabarnia — The Flash",
    });

    const model = await mockRoomReadCapabilities.getRanking("tabarnia-room", mockQueryContext());
    if (!model) throw new Error("Expected ranking model");
    const markup = renderToStaticMarkup(
      <FlashPopRoomRanking
        roomId={model.roomId}
        currentUserId={model.currentUserId}
        entries={model.entries}
      />,
    );

    expect(markup).toContain("Ranking global");
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
});
