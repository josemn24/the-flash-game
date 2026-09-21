import { describe, expect, it } from "vitest";
import {
  calculateSurvivalSeasonXp,
  getFlashPopSurvivalResult,
} from "@/features/flash-pop/survivalSocial";

describe("Flash Pop Survival social adapter", () => {
  it("caps a complete, fast survival run at 120 XP", () => {
    expect(
      calculateSurvivalSeasonXp({ questionsReached: 20, totalQuestions: 20, totalTime: 0 }, 600),
    ).toBe(120);
  });

  it("uses a demo fallback for unknown challenges", () => {
    const result = getFlashPopSurvivalResult(
      {
        challengeId: "future-survival",
        score: 42,
        questionsReached: 3,
        totalQuestions: 12,
        livesRemaining: 1,
        totalTime: 48,
        survived: false,
      },
      { totalTimeLimit: 240 },
    );

    expect(result.socialSource).toBe("demo");
    expect(result.totalPlayers).toBe(7);
    expect(result.peers.some((row) => row.player.id === "javi")).toBe(true);
  });

  it("ranks equal scores by time used", () => {
    const result = getFlashPopSurvivalResult({
      challengeId: "future-survival",
      score: 92,
      questionsReached: 10,
      totalQuestions: 10,
      livesRemaining: 2,
      totalTime: 100,
      survived: true,
    });

    expect(result.playerRank).toBe(1);
    expect(result.peers[0]?.player.id).toBe("javi");
  });
});
