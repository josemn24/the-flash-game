import type { ScheduledChallenge } from "@/types/game";

export const demoSeasonScheduledChallenges = [
  {
    id: "demo-challenge",
    number: 1,
    seasonId: "demo-season",
    challengeDefinitionId: "demo-challenge-definition",
    availableFrom: "2026-07-01T00:00:00.000Z",
    availableUntil: "2026-07-31T23:59:59.999Z",
  },
  {
    id: "connections-challenge",
    number: 2,
    seasonId: "demo-season",
    challengeDefinitionId: "connections-challenge-definition",
    availableFrom: "2026-07-01T00:00:00.000Z",
    availableUntil: "2026-07-31T23:59:59.999Z",
  },
] satisfies ScheduledChallenge[];
