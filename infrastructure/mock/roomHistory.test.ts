import { describe, expect, it } from "vitest";
import { mockDomainStore } from "@/data/mock/store";
import {
  mockRoomKeys,
  playerRouteAliases,
  scheduledChallengeRouteAliases,
} from "@/data/mock/constants";
import { utc } from "@/data/mock/identity";
import { createMockRoomReadCapabilities, mockQueryContext } from "@/test-utils/mockRoom";

const publicationId = scheduledChallengeRouteAliases["tabarnia-challenge-02"];
const closesAt = "2026-09-12T12:00:00.000Z";
const now = new Date(closesAt);

function storeWithPublication(status: "open" | "scheduled" | "cancelled") {
  return {
    ...mockDomainStore,
    scheduledChallenges: mockDomainStore.scheduledChallenges.map((schedule) =>
      schedule.id === publicationId
        ? { ...schedule, status, opensAt: utc("2026-09-11T00:00:00Z"), closesAt: utc(closesAt) }
        : schedule,
    ),
  };
}

describe("mock history and review effective closure", () => {
  it.each(["open", "scheduled"] as const)(
    "uses QueryContext.now for a persisted %s publication",
    async (status) => {
      const reads = createMockRoomReadCapabilities(storeWithPublication(status));
      const before = await reads.listHistory(
        "tabarnia-room",
        mockQueryContext(new Date(now.getTime() - 1)),
      );
      expect(before?.entries.some((entry) => entry.challengeId === "tabarnia-challenge-02")).toBe(
        false,
      );
      const closed = await reads.listHistory("tabarnia-room", mockQueryContext(now));
      expect(
        closed?.entries.find((entry) => entry.challengeId === "tabarnia-challenge-02"),
      ).toMatchObject({ mode: "alphabet" });
      const review = await reads.getMemberDetail(
        "tabarnia-room",
        "ches",
        mockQueryContext(now),
        "tabarnia-challenge-02",
      );
      expect(review?.reviewProgress?.mode).toBe("alphabet");
      expect(review?.reviewItems.every((item) => Boolean(item.metadata?.alphabetLetter))).toBe(
        true,
      );
    },
  );

  it("keeps cancellations, drafts and in-progress attempts out", async () => {
    const cancelled = await createMockRoomReadCapabilities(
      storeWithPublication("cancelled"),
    ).listHistory("tabarnia-room", mockQueryContext(now));
    expect(cancelled?.entries.some((entry) => entry.challengeId === "tabarnia-challenge-02")).toBe(
      false,
    );
    const base = storeWithPublication("open");
    const blocked = createMockRoomReadCapabilities({
      ...base,
      attempts: base.attempts.map((attempt) =>
        attempt.scheduledChallengeId === publicationId
          ? { ...attempt, status: "in_progress" as const }
          : attempt,
      ),
    });
    expect(
      (await blocked.listHistory("tabarnia-room", mockQueryContext(now)))?.entries.some(
        (entry) => entry.challengeId === "tabarnia-challenge-02",
      ),
    ).toBe(false);
    const draft = createMockRoomReadCapabilities({
      ...base,
      seasons: base.seasons.map((season) =>
        season.roomId === mockRoomKeys["tabarnia-room"]
          ? { ...season, status: "draft" as const }
          : season,
      ),
    });
    expect((await draft.listHistory("tabarnia-room", mockQueryContext(now)))?.entries).toEqual([]);
  });

  it("projects Narrative questions and denies spectator review by direct route", async () => {
    const reads = createMockRoomReadCapabilities(mockDomainStore);
    const narrative = await reads.getMemberDetail(
      "tabarnia-room",
      "ches",
      mockQueryContext(now),
      "tabarnia-challenge-04",
    );
    expect(narrative?.reviewProgress?.mode).toBe("narrative");
    expect(narrative?.reviewItems.length).toBeGreaterThan(0);
    const spectatorStore = {
      ...mockDomainStore,
      roomMemberships: mockDomainStore.roomMemberships.map((membership) =>
        membership.playerId === playerRouteAliases.player
          ? { ...membership, role: "spectator" as const }
          : membership,
      ),
    };
    const spectator = createMockRoomReadCapabilities(spectatorStore);
    expect(
      (await spectator.listHistory("tabarnia-room", mockQueryContext(now)))?.entries,
    ).toHaveLength(5);
    await expect(
      spectator.getMemberDetail(
        "tabarnia-room",
        "ches",
        mockQueryContext(now),
        "tabarnia-challenge-02",
      ),
    ).resolves.toBeNull();
  });
});
