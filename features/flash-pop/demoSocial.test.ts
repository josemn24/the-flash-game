import { describe, expect, it } from "vitest";
import {
  calculateSeasonXp,
  getFlashPopAttemptStatus,
  getFlashPopLobbyChallenge,
  getFlashPopResult,
  isFlashPopPreviewChallenge,
} from "@/features/flash-pop/demoSocial";

describe("Flash Pop demo social adapter", () => {
  it("derives lobby status from the canonical attempt state", () => {
    expect(getFlashPopAttemptStatus(null)).toBe("available");
    expect(getFlashPopAttemptStatus({ status: "in-progress" })).toBe("inProgress");
    expect(getFlashPopAttemptStatus({ status: "completed" })).toBe("completed");
    expect(getFlashPopLobbyChallenge(null).status).toBe("available");
    expect(getFlashPopLobbyChallenge(null, "tabarnia-challenge-06").title).toContain(
      "Biblia y religiones abrahámicas",
    );
    expect(isFlashPopPreviewChallenge("tabarnia-challenge-05")).toBe(true);
    expect(isFlashPopPreviewChallenge("tabarnia-challenge-06")).toBe(true);
    expect(isFlashPopPreviewChallenge("another-challenge")).toBe(false);
  });

  it("calculates capped season XP deterministically", () => {
    expect(calculateSeasonXp({ levelsCleared: 0, timeUsed: 235 })).toBe(40);
    expect(calculateSeasonXp({ levelsCleared: 7, timeUsed: 0 })).toBe(120);
    expect(calculateSeasonXp({ levelsCleared: 99, timeUsed: -10 })).toBe(120);
  });

  it("ranks the player by score and then time", () => {
    const result = getFlashPopResult({
      challengeId: "tabarnia-challenge-05",
      levelsCleared: 7,
      score: 100,
      timeUsed: 0,
      outcome: "summit",
      completedAt: 100,
    });

    expect(result.playerRank).toBe(1);
    expect(result.levelsCleared).toBe(7);
    expect(result.peers[0]?.player.id).toBe("javi");
    expect(result.totalPlayers).toBe(8);
    expect(result.seasonXpEarned).toBe(120);
    expect(result.socialSource).toBe("demo");
  });

  it("uses the generic demo fixture for any pyramid challenge", () => {
    const result = getFlashPopResult(
      {
        challengeId: "future-pyramid-challenge",
        levelsCleared: 2,
        score: 25,
        timeUsed: 20,
        outcome: "failed",
        completedAt: 100,
      },
      { levelCount: 3, totalTimeLimit: 30 },
    );

    expect(result.socialSource).toBe("demo");
    expect(result.totalPlayers).toBe(8);
    expect(result.levelsCleared).toBe(2);
  });

  it("shows an unsuccessful attempt as not completed", () => {
    const result = getFlashPopResult({
      challengeId: "tabarnia-challenge-05",
      levelsCleared: 0,
      score: 0,
      timeUsed: 12,
      outcome: "failed",
      completedAt: 100,
    });

    expect(result.playerRank).toBe(8);
    expect(result.seasonXpEarned).toBe(59);
    expect(
      getFlashPopLobbyChallenge({
        status: "completed",
        summary: {
          challengeId: "tabarnia-challenge-05",
          levelsCleared: 0,
          score: 0,
          timeUsed: 12,
          outcome: "failed",
          completedAt: 100,
        },
      }).status,
    ).toBe("notCompleted");
  });
});
