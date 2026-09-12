import { describe, expect, it } from "vitest";
import { getRoomHistory, getRoomHistoryEntry } from "./roomHistory";

describe("room history mock", () => {
  it("provides previous games for Tabarnia", () => {
    const entries = getRoomHistory("tabarnia-room");

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      challengeId: "tabarnia-challenge-05",
      playerCount: 4,
      ranking: [
        { memberId: "ches", points: 52 },
        { memberId: "marta", points: 44 },
        { memberId: "alex", points: 39 },
        { memberId: "player", points: 33 },
      ],
    });
  });

  it("finds a historical challenge by its challenge id", () => {
    expect(getRoomHistoryEntry("tabarnia-room", "tabarnia-challenge-04")).toMatchObject({
      title: "P-17: Señales en la nieve",
    });
    expect(getRoomHistoryEntry("tabarnia-room", "unknown-challenge")).toBeUndefined();
  });

  it("returns an empty history for unknown rooms", () => {
    expect(getRoomHistory("unknown-room")).toEqual([]);
  });
});
