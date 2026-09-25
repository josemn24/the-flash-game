import { describe, expect, it } from "vitest";
import { upsertRoomSessionResult } from "@/features/rooms/RoomSessionProvider.client";

describe("room session results", () => {
  const completion = (overrides: { roomId: string; challengeId: string; flashPoints: number }) => ({
    ...overrides,
    completed: true,
    startedAt: "2026-09-08T15:38:00.000Z",
    playedAt: "2026-09-08T15:39:00.000Z",
    durationMs: 60_000,
    answers: [],
  });

  it("keeps the first terminal result and ignores a later completion", () => {
    const first = upsertRoomSessionResult(
      {},
      completion({
        roomId: "tabarnia-room",
        challengeId: "tabarnia-challenge-05",
        flashPoints: 80,
      }),
    );
    const second = upsertRoomSessionResult(
      first,
      completion({
        roomId: "tabarnia-room",
        challengeId: "tabarnia-challenge-05",
        flashPoints: 42,
      }),
    );

    expect(second["tabarnia-room"]["tabarnia-challenge-05"]).toEqual({
      flashPoints: 80,
      completed: true,
      attempt: {
        challengeId: "tabarnia-challenge-05",
        startedAt: "2026-09-08T15:38:00.000Z",
        playedAt: "2026-09-08T15:39:00.000Z",
        flashPoints: 80,
        completed: true,
        durationMs: 60_000,
        answers: [],
      },
    });
  });

  it("keeps results isolated by room and challenge", () => {
    const state = upsertRoomSessionResult(
      upsertRoomSessionResult(
        {},
        completion({
          roomId: "tabarnia-room",
          challengeId: "tabarnia-challenge-05",
          flashPoints: 80,
        }),
      ),
      completion({ roomId: "other-room", challengeId: "other-challenge", flashPoints: 20 }),
    );

    expect(Object.keys(state)).toEqual(["tabarnia-room", "other-room"]);
    expect(state["tabarnia-room"]["tabarnia-challenge-05"].flashPoints).toBe(80);
  });
});
