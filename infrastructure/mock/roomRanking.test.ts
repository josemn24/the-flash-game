import { describe, expect, it } from "vitest";
import { mockDomainStore } from "@/data/mock/store";
import { DEMO_REFERENCE_TIME, mockRoomKeys } from "@/data/mock/constants";
import { createMockRoomReadCapabilities, mockQueryContext } from "@/test-utils/mockRoom";

describe("mock ranking after season closure", () => {
  it("preserves the same standings when the active season finishes", async () => {
    const context = mockQueryContext(new Date(DEMO_REFERENCE_TIME));
    const current = await createMockRoomReadCapabilities(mockDomainStore).getRanking(
      "tabarnia-room",
      context,
    );
    const finished = await createMockRoomReadCapabilities({
      ...mockDomainStore,
      seasons: mockDomainStore.seasons.map((season) =>
        season.roomId === mockRoomKeys["tabarnia-room"]
          ? { ...season, status: "finished" as const }
          : season,
      ),
    }).getRanking("tabarnia-room", context);
    expect(current?.season?.status).toBe("active");
    expect(finished?.season).toEqual({ ...current?.season, status: "finished" });
    expect(finished?.entries).toEqual(current?.entries);
  });

  it("returns a visible empty state when the room only has draft seasons", async () => {
    const ranking = await createMockRoomReadCapabilities({
      ...mockDomainStore,
      seasons: mockDomainStore.seasons.map((season) => ({ ...season, status: "draft" as const })),
    }).getRanking("tabarnia-room", mockQueryContext());
    expect(ranking).toMatchObject({ roomTitle: "Tabarnia", season: null, entries: [] });
  });
});
