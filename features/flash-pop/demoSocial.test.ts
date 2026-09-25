import { describe, expect, it } from "vitest";
import {
  getFlashPopAttemptStatus,
  getFlashPopLobbyChallenge,
  getFlashPopResult,
  isFlashPopPreviewChallenge,
} from "@/features/flash-pop/demoSocial";
import { makeSocialSnapshot } from "@/features/flash-pop/socialSnapshot.test-utils";

const challengeContent = { title: "La Pirámide", subtitle: "Cumbre lógica" };

describe("Flash Pop demo social adapter", () => {
  it("derives lobby status from the canonical attempt state", () => {
    expect(getFlashPopAttemptStatus(null)).toBe("available");
    expect(getFlashPopAttemptStatus({ status: "in-progress" })).toBe("inProgress");
    expect(getFlashPopAttemptStatus({ status: "completed" })).toBe("completed");
    expect(
      getFlashPopLobbyChallenge(
        null,
        "tabarnia-challenge-05",
        makeSocialSnapshot(),
        challengeContent,
      ).status,
    ).toBe("available");
    expect(
      getFlashPopLobbyChallenge(null, "tabarnia-challenge-06", makeSocialSnapshot(), {
        title: "Biblia y religiones abrahámicas",
        subtitle: "Conexiones",
      }).title,
    ).toContain("Biblia y religiones abrahámicas");
    expect(isFlashPopPreviewChallenge("tabarnia-challenge-05")).toBe(true);
    expect(isFlashPopPreviewChallenge("tabarnia-challenge-06")).toBe(true);
    expect(isFlashPopPreviewChallenge("another-challenge")).toBe(false);
  });

  it("uses the challenge score as normalized Flash Points", () => {
    const baseSummary = {
      challengeId: "tabarnia-challenge-05",
      levelsCleared: 7,
      timeUsed: 0,
      outcome: "summit" as const,
      completedAt: 100,
      startedAt: 0,
    };

    expect(
      getFlashPopResult({ ...baseSummary, score: 0 }, makeSocialSnapshot(0)).flashPointsEarned,
    ).toBe(0);
    expect(
      getFlashPopResult({ ...baseSummary, score: 100 }, makeSocialSnapshot(0)).flashPointsEarned,
    ).toBe(100);
    expect(
      getFlashPopResult({ ...baseSummary, score: 150 }, makeSocialSnapshot(0)).flashPointsEarned,
    ).toBe(100);
    expect(
      getFlashPopResult({ ...baseSummary, score: -10 }, makeSocialSnapshot(0)).flashPointsEarned,
    ).toBe(0);
  });

  it("ranks the player by score and then time", () => {
    const result = getFlashPopResult(
      {
        challengeId: "tabarnia-challenge-05",
        levelsCleared: 7,
        score: 80,
        timeUsed: 0,
        outcome: "summit",
        completedAt: 100,
        startedAt: 0,
      },
      makeSocialSnapshot(),
    );

    expect(result.playerRank).toBe(1);
    expect(result.levelsCleared).toBe(7);
    expect(result.peers[0]?.player.id).toBe("player");
    expect(result.totalPlayers).toBe(4);
    expect(result.flashPointsEarned).toBe(80);
    expect(result.socialSource).toBe("demo");
  });

  it("keeps the season total above the next visual milestone", () => {
    const result = getFlashPopResult(
      {
        challengeId: "tabarnia-challenge-05",
        levelsCleared: 7,
        score: 100,
        timeUsed: 0,
        outcome: "summit",
        completedAt: 100,
        startedAt: 0,
      },
      makeSocialSnapshot(0),
      { seasonFlashPoints: 880 },
    );

    expect(result.seasonFlashPoints).toBe(980);
  });

  it("does not invent peers for a challenge without canonical attempts", () => {
    const result = getFlashPopResult(
      {
        challengeId: "future-pyramid-challenge",
        levelsCleared: 2,
        score: 25,
        timeUsed: 20,
        outcome: "failed",
        completedAt: 100,
        startedAt: 0,
      },
      makeSocialSnapshot(0),
    );

    expect(result.socialSource).toBe("demo");
    expect(result.totalPlayers).toBe(1);
    expect(result.levelsCleared).toBe(2);
  });

  it("shows a failed-level attempt as completed", () => {
    const result = getFlashPopResult(
      {
        challengeId: "tabarnia-challenge-05",
        levelsCleared: 0,
        score: 0,
        timeUsed: 12,
        outcome: "failed",
        completedAt: 100,
        startedAt: 0,
      },
      makeSocialSnapshot(),
    );

    expect(result.playerRank).toBe(4);
    expect(result.flashPointsEarned).toBe(0);
    expect(
      getFlashPopLobbyChallenge(
        {
          status: "completed",
          summary: {
            challengeId: "tabarnia-challenge-05",
            levelsCleared: 0,
            score: 0,
            timeUsed: 12,
            outcome: "failed",
            completedAt: 100,
            startedAt: 0,
          },
        },
        "tabarnia-challenge-05",
        makeSocialSnapshot(),
        challengeContent,
      ).status,
    ).toBe("completed");
    expect(
      getFlashPopAttemptStatus({
        status: "completed",
        summary: {
          challengeId: "tabarnia-challenge-05",
          levelsCleared: 0,
          score: 0,
          timeUsed: 12,
          outcome: "failed",
          completedAt: 100,
          startedAt: 0,
        },
      }),
    ).toBe("completed");
  });

  it("uses active Tabarnia memberships and leaves challenge 06 activity empty", () => {
    const challenge06Snapshot = { ...makeSocialSnapshot(4), peers: [] };
    const lobby = getFlashPopLobbyChallenge(null, "tabarnia-challenge-06", challenge06Snapshot, {
      title: "Biblia y religiones abrahámicas",
      subtitle: "Conexiones",
    });
    expect(lobby.participants.map(({ displayName }) => displayName)).toEqual([
      "Dark",
      "Jackobo",
      "Rielbe",
      "Palmera",
    ]);
    expect(lobby.totalPlayers).toBe(5);
    expect(lobby.activities).toEqual([]);
  });
});
