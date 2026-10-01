import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FlashPopRoomHistory } from "@/components/game/modes/flash-pop/FlashPopRoomHistory";
import { mockQueryContext, mockRoomReadCapabilities } from "@/test-utils/mockRoom";

const mocks = vi.hoisted(() => ({
  getRoomHistoryPageModel: vi.fn(),
}));

vi.mock("@/server/production-room-data-access", () => mocks);

import { dynamic, generateMetadata } from "./page";

describe("room history route", () => {
  it("exposes Tabarnia and renders previous games", async () => {
    expect(dynamic).toBe("force-dynamic");
    mocks.getRoomHistoryPageModel.mockResolvedValue(
      await mockRoomReadCapabilities.listHistory("tabarnia-room", mockQueryContext()),
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Historial de Tabarnia — The Flash",
    });

    const model = await mockRoomReadCapabilities.listHistory("tabarnia-room", mockQueryContext());
    if (!model) throw new Error("Expected history model");
    const markup = renderToStaticMarkup(<FlashPopRoomHistory {...model} />);

    expect(markup).toContain("Historial");
    expect(markup).toContain("5 sept");
    expect(markup).toContain("4 jugadores");
    expect(markup).toContain("Ganador:");
    expect(markup).toContain("Dark");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).toContain('href="/salas/tabarnia-room/historial/tabarnia-challenge-05"');
    expect(markup.match(/Ver ranking/g)).toHaveLength(3);
  });
});
