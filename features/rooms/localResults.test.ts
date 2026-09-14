import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomDetailModel } from "@/test-utils/legacy/roomDetail";
import type { ChallengeCompletion } from "@/types/game";
import { applyRoomChallengeResult } from "./localResults";

const completion = (flashPoints: number): ChallengeCompletion => ({
  roomId: "tabarnia-room",
  challengeId: "tabarnia-challenge-06",
  flashPoints,
  completed: true,
  startedAt: "2026-09-13T09:59:00.000Z",
  playedAt: "2026-09-13T10:00:00.000Z",
  durationMs: 60_000,
  answers: [],
});

describe("local room results", () => {
  it("does not apply the same competitive challenge twice", () => {
    const model = buildRoomDetailModel(demoRoom, new Date("2026-09-06T12:00:00.000Z"));
    const first = applyRoomChallengeResult(model, completion(80));
    const second = applyRoomChallengeResult(first, completion(42));

    expect(second.currentUser.dailyFlashPoints).toBe(80);
    expect(second.currentUser.totalFlashPoints).toBe(first.currentUser.totalFlashPoints);
    expect(second.dailyLeaderboard).toEqual(first.dailyLeaderboard);
  });
});
