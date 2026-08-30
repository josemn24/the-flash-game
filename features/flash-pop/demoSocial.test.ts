import { describe, expect, it } from "vitest";
import {
  calculateSeasonXp,
  getFlashPopAttemptStatus,
  getFlashPopLobbyChallenge,
  getFlashPopResult,
} from "@/features/flash-pop/demoSocial";

describe("Flash Pop demo social adapter", () => {
  it("derives lobby status from the canonical attempt state", () => {
    expect(getFlashPopAttemptStatus(null)).toBe("available");
    expect(getFlashPopAttemptStatus({ status: "in-progress" })).toBe("inProgress");
    expect(getFlashPopAttemptStatus({ status: "completed" })).toBe("completed");
    expect(getFlashPopLobbyChallenge(null).status).toBe("available");
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
  });

  it("keeps an unsuccessful attempt completed without pretending it is replayable", () => {
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
    ).toBe("completed");
  });
});
