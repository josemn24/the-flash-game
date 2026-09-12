import { describe, expect, it } from "vitest";
import {
  calculateAlphabetSeasonXp,
  getFlashPopAlphabetResult,
} from "@/features/flash-pop/alphabetSocial";
import { makeSocialSnapshot } from "@/features/flash-pop/socialSnapshot.test-utils";

describe("Flash Pop Alphabet social adapter", () => {
  it("caps a complete fast run at 120 XP", () => {
    expect(
      calculateAlphabetSeasonXp({ correctAnswers: 18, totalLetters: 18, elapsedTime: 0 }, 135),
    ).toBe(120);
  });

  it("does not invent peers for an unknown Alphabet challenge", () => {
    const result = getFlashPopAlphabetResult(
      {
        challengeId: "future-alphabet",
        score: 50,
        correctAnswers: 9,
        totalLetters: 18,
        elapsedTime: 80,
        lastCorrectAt: 70,
      },
      makeSocialSnapshot(0),
      { timeLimit: 135 },
    );

    expect(result.socialSource).toBe("demo");
    expect(result.totalPlayers).toBe(1);
    expect(result.peers.some((row) => row.player.id === "player")).toBe(true);
  });

  it("orders equal scores by the last correct answer time", () => {
    const result = getFlashPopAlphabetResult(
      {
        challengeId: "future-alphabet",
        score: 89,
        correctAnswers: 16,
        totalLetters: 18,
        elapsedTime: 100,
        lastCorrectAt: 90,
      },
      makeSocialSnapshot(),
    );

    expect(result.playerRank).toBe(1);
    expect(result.peers[0]?.player.id).toBe("player");
  });
});
