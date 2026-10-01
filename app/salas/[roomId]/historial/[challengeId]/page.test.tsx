import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FlashPopRoomHistoryDetail } from "@/components/game/modes/flash-pop/FlashPopRoomHistoryDetail";
import { mockQueryContext, mockRoomReadCapabilities } from "@/test-utils/mockRoom";

const mocks = vi.hoisted(() => ({
  getRoomHistoryDetailPageModel: vi.fn(),
}));

vi.mock("@/server/production-room-data-access", () => mocks);

import { dynamic, generateMetadata } from "./page";

describe("room history detail route", () => {
  it("exposes historical challenge rankings", async () => {
    expect(dynamic).toBe("force-dynamic");
    mocks.getRoomHistoryDetailPageModel.mockResolvedValue(
      await mockRoomReadCapabilities.getHistoryDetail(
        "tabarnia-room",
        "tabarnia-challenge-05",
        mockQueryContext(),
      ),
    );
    await expect(
      generateMetadata({
        params: Promise.resolve({ roomId: "tabarnia-room", challengeId: "tabarnia-challenge-05" }),
      }),
    ).resolves.toMatchObject({
      title: "Ranking de La Pirámide: Cumbre lógica — Tabarnia — The Flash",
    });

    const model = await mockRoomReadCapabilities.getHistoryDetail(
      "tabarnia-room",
      "tabarnia-challenge-05",
      mockQueryContext(),
    );
    if (!model) throw new Error("Expected history detail model");
    const markup = renderToStaticMarkup(<FlashPopRoomHistoryDetail {...model} />);

    expect(markup).toContain("La Pirámide: Cumbre lógica");
    expect(markup).toContain("Ranking del desafío");
    expect(markup).toContain("Dark");
    expect(markup).toContain("52");
    expect(markup).toContain("Jackobo");
    expect(markup).toContain("44");
    expect(markup).toContain('href="/salas/tabarnia-room/historial"');
    expect(model.canReviewMembers).toBe(true);
  });

  it("renders an empty state when the challenge has no completed results", async () => {
    const model = await mockRoomReadCapabilities.getHistoryDetail(
      "tabarnia-room",
      "tabarnia-challenge-05",
      mockQueryContext(),
    );
    if (!model) throw new Error("Expected history detail model");

    const markup = renderToStaticMarkup(
      <FlashPopRoomHistoryDetail
        roomId={model.roomId}
        roomTitle={model.roomTitle}
        entry={model.entry}
        ranking={[]}
        currentUserId={model.currentUserId}
      />,
    );

    expect(markup).toContain("No hay resultados disponibles.");
  });
});
