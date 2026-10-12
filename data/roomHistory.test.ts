import { describe, expect, it } from "vitest";
import {
  getMockRoomHistory as getRoomHistory,
  getMockRoomHistoryEntry as getRoomHistoryEntry,
} from "@/test-utils/mockRoom";

describe("room history mock", () => {
  it("provides previous games for Tabarnia", () => {
    const entries = getRoomHistory("tabarnia-room", new Date("2026-09-12T12:00:00Z"));

    expect(entries).toHaveLength(5);
    expect(entries[0]).toMatchObject({
      challengeId: "tabarnia-challenge-05",
      mode: "pyramid",
      formatLabel: "La Pirámide",
      playerCount: 4,
      ranking: [
        { memberId: "ches", flashPoints: 52 },
        { memberId: "marta", flashPoints: 44 },
        { memberId: "alex", flashPoints: 39 },
        { memberId: "player", flashPoints: 33 },
      ],
    });
  });

  it("finds a historical challenge by its challenge id", () => {
    expect(getRoomHistoryEntry("tabarnia-room", "tabarnia-challenge-04")).toMatchObject({
      mode: "narrative",
    });
    expect(getRoomHistoryEntry("tabarnia-room", "tabarnia-challenge-02")).toMatchObject({
      mode: "alphabet",
    });
    expect(getRoomHistoryEntry("tabarnia-room", "unknown-challenge")).toBeUndefined();
  });

  it("returns an empty history for unknown rooms", () => {
    expect(getRoomHistory("unknown-room")).toEqual([]);
  });
});
