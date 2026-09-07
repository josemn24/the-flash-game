import { describe, expect, it } from "vitest";
import { upsertRoomSessionResult } from "@/features/rooms/RoomSessionProvider.client";

describe("room session results", () => {
  it("replaces a previous result without accumulating replay points", () => {
    const first = upsertRoomSessionResult({}, {
      roomId: "tabarnia-room",
      challengeId: "tabarnia-challenge-05",
      points: 80,
      completed: true,
    });
    const second = upsertRoomSessionResult(first, {
      roomId: "tabarnia-room",
      challengeId: "tabarnia-challenge-05",
      points: 42,
      completed: true,
    });

    expect(second["tabarnia-room"]["tabarnia-challenge-05"]).toEqual({
      points: 42,
      completed: true,
    });
  });

  it("keeps results isolated by room and challenge", () => {
    const state = upsertRoomSessionResult(
      upsertRoomSessionResult({}, {
        roomId: "tabarnia-room",
        challengeId: "tabarnia-challenge-05",
        points: 80,
        completed: true,
      }),
      {
        roomId: "other-room",
        challengeId: "other-challenge",
        points: 20,
        completed: true,
      },
    );

    expect(Object.keys(state)).toEqual(["tabarnia-room", "other-room"]);
    expect(state["tabarnia-room"]["tabarnia-challenge-05"].points).toBe(80);
  });
});
