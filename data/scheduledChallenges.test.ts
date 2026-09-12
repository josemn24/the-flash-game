import { describe, expect, it } from "vitest";
import { demoSeasonScheduledChallenges } from "@/data/scheduledChallenges";
import { getChallengeAvailabilityStatus } from "@/lib/challengeAvailability";
import type { PlayableScheduledChallenge } from "@/types/game";

const availableFrom = "2026-09-05T22:00:00.000Z";
const availableUntil = "2026-09-20T21:59:59.999Z";

describe("demo season challenge availability", () => {
  it("keeps every implemented challenge available through September 20", () => {
    const playableChallenges = demoSeasonScheduledChallenges.filter(
      (challenge): challenge is PlayableScheduledChallenge => "challengeDefinitionId" in challenge,
    );

    expect(playableChallenges).toHaveLength(6);
    expect(
      playableChallenges.every(
        (challenge) =>
          challenge.availableFrom === availableFrom && challenge.availableUntil === availableUntil,
      ),
    ).toBe(true);
  });

  it("makes the implemented challenges available at both date boundaries", () => {
    const playableChallenges = demoSeasonScheduledChallenges.filter(
      (challenge): challenge is PlayableScheduledChallenge => "challengeDefinitionId" in challenge,
    );

    expect(
      playableChallenges.every(
        (challenge) =>
          getChallengeAvailabilityStatus(
            challenge.availableFrom,
            challenge.availableUntil,
            new Date(availableFrom),
          ) === "available" &&
          getChallengeAvailabilityStatus(
            challenge.availableFrom,
            challenge.availableUntil,
            new Date(availableUntil),
          ) === "available",
      ),
    ).toBe(true);
  });
});
