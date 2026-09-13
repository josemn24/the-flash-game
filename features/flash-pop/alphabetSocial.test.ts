import { describe, expect, it } from "vitest";
import { getFlashPopAlphabetResult } from "@/features/flash-pop/alphabetSocial";
import { makeSocialSnapshot } from "@/features/flash-pop/socialSnapshot.test-utils";

describe("Flash Pop Alphabet social adapter", () => {
  it("uses the challenge score as Flash Points", () => {
    const result = getFlashPopAlphabetResult(
      {
        challengeId: "future-alphabet",
        score: 100,
        correctAnswers: 18,
        totalLetters: 18,
        elapsedTime: 0,
        lastCorrectAt: 0,
        completedAt: "2026-09-01T12:00:00.000Z",
      },
      makeSocialSnapshot(0),
    );

    expect(result.flashPointsEarned).toBe(100);
    expect(result.seasonFlashPoints).toBe(740);
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
        completedAt: "2026-09-01T12:00:00.000Z",
      },
      makeSocialSnapshot(0),
      { seasonFlashPoints: 640 },
    );

    expect(result.socialSource).toBe("demo");
    expect(result.totalPlayers).toBe(1);
    expect(result.peers.some((row) => row.player.id === "player")).toBe(true);
  });

  it("ranks by Flash Points and uses time as the tie-breaker", () => {
    const snapshot = makeSocialSnapshot(1);
    const peer = snapshot.peers[0];
    if (!peer) throw new Error("Expected a peer");
    const result = getFlashPopAlphabetResult(
      {
        challengeId: "future-alphabet",
        score: 89,
        correctAnswers: 16,
        totalLetters: 18,
        elapsedTime: 100,
        lastCorrectAt: 90,
        completedAt: "2026-09-02T12:00:00.000Z",
      },
      {
        ...snapshot,
        peers: [{ ...peer, flashPoints: 89, timeUsed: 120, lastCorrectAt: 90 }],
      },
    );

    expect(result.playerRank).toBe(2);
    expect(result.peers[0]?.player.id).toBe("ches");
  });
});
