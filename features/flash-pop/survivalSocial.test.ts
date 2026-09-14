import { describe, expect, it } from "vitest";
import { getFlashPopSurvivalResult } from "@/features/flash-pop/survivalSocial";
import { makeSocialSnapshot } from "@/features/flash-pop/socialSnapshot.test-utils";

describe("Flash Pop Survival social adapter", () => {
  it("uses the challenge score as Flash Points", () => {
    const result = getFlashPopSurvivalResult(
      {
        challengeId: "future-survival",
        score: 100,
        questionsReached: 20,
        totalQuestions: 20,
        livesRemaining: 3,
        totalTime: 0,
        survived: true,
        startedAt: "2026-09-01T11:00:00.000Z",
      },
      makeSocialSnapshot(0),
    );

    expect(result.flashPointsEarned).toBe(100);
    expect(result.seasonFlashPoints).toBe(740);
  });

  it("does not invent peers for unknown challenges", () => {
    const result = getFlashPopSurvivalResult(
      {
        challengeId: "future-survival",
        score: 42,
        questionsReached: 3,
        totalQuestions: 12,
        livesRemaining: 1,
        totalTime: 48,
        survived: false,
        startedAt: "2026-09-01T11:00:00.000Z",
      },
      makeSocialSnapshot(0),
      { seasonFlashPoints: 640 },
    );

    expect(result.socialSource).toBe("demo");
    expect(result.totalPlayers).toBe(1);
    expect(result.peers.some((row) => row.player.id === "player")).toBe(true);
  });

  it("ranks equal scores by time used", () => {
    const result = getFlashPopSurvivalResult(
      {
        challengeId: "future-survival",
        score: 80,
        questionsReached: 10,
        totalQuestions: 10,
        livesRemaining: 2,
        totalTime: 100,
        survived: true,
        startedAt: "2026-09-01T11:00:00.000Z",
      },
      makeSocialSnapshot(),
    );

    expect(result.playerRank).toBe(2);
    expect(result.peers[0]?.player.id).toBe("ches");
  });
});
