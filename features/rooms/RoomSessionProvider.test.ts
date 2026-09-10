import { describe, expect, it } from "vitest";
import { upsertRoomSessionResult } from "@/features/rooms/RoomSessionProvider.client";

describe("room session results", () => {
  const completion = (overrides: { roomId: string; challengeId: string; points: number }) => ({
    ...overrides,
    completed: true,
    playedAt: "2026-09-08T15:39:00.000Z",
    answers: [],
  });

  it("replaces a previous result without accumulating replay points", () => {
    const first = upsertRoomSessionResult(
      {},
      completion({ roomId: "tabarnia-room", challengeId: "tabarnia-challenge-05", points: 80 }),
    );
    const second = upsertRoomSessionResult(
      first,
      completion({ roomId: "tabarnia-room", challengeId: "tabarnia-challenge-05", points: 42 }),
    );

    expect(second["tabarnia-room"]["tabarnia-challenge-05"]).toEqual({
      points: 42,
      completed: true,
      attempt: {
        challengeId: "tabarnia-challenge-05",
        playedAt: "2026-09-08T15:39:00.000Z",
        points: 42,
        completed: true,
        answers: [],
      },
    });
  });

  it("keeps results isolated by room and challenge", () => {
    const state = upsertRoomSessionResult(
      upsertRoomSessionResult(
        {},
        completion({ roomId: "tabarnia-room", challengeId: "tabarnia-challenge-05", points: 80 }),
      ),
      completion({ roomId: "other-room", challengeId: "other-challenge", points: 20 }),
    );

    expect(Object.keys(state)).toEqual(["tabarnia-room", "other-room"]);
    expect(state["tabarnia-room"]["tabarnia-challenge-05"].points).toBe(80);
  });
});
