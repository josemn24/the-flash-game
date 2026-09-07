import { describe, expect, it } from "vitest";
import { getRoomHistory } from "./roomHistory";

describe("room history mock", () => {
  it("provides previous games for Tabarnia", () => {
    const entries = getRoomHistory("tabarnia-room");

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      challengeId: "tabarnia-challenge-05",
      playerCount: 4,
      winnerMemberId: "ches",
    });
  });

  it("returns an empty history for unknown rooms", () => {
    expect(getRoomHistory("unknown-room")).toEqual([]);
  });
});
