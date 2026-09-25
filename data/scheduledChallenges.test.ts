import { describe, expect, it } from "vitest";
import { mockScheduledChallenges as demoSeasonScheduledChallenges } from "@/test-utils/mockRoom";
import type { PlayableScheduledChallenge } from "@/types/game";

describe("demo season challenge availability", () => {
  it("keeps only the six implemented publications in chronological windows", () => {
    const playableChallenges = demoSeasonScheduledChallenges.filter(
      (challenge): challenge is PlayableScheduledChallenge => "challengeDefinitionId" in challenge,
    );

    expect(playableChallenges).toHaveLength(6);
    expect(playableChallenges.map(({ id }) => id)).toEqual([
      "tabarnia-flash-01",
      "tabarnia-challenge-02",
      "tabarnia-challenge-03",
      "tabarnia-challenge-04",
      "tabarnia-challenge-05",
      "tabarnia-challenge-06",
    ]);
  });

  it("does not overlap publication windows", () => {
    const playableChallenges = demoSeasonScheduledChallenges.filter(
      (challenge): challenge is PlayableScheduledChallenge => "challengeDefinitionId" in challenge,
    );

    for (let index = 1; index < playableChallenges.length; index += 1) {
      expect(playableChallenges[index - 1]?.availableUntil).toBe(
        playableChallenges[index]?.availableFrom,
      );
    }
  });
});
