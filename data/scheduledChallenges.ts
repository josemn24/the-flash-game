import { challengeDefinitions, challengeVersions } from "@/data/mock/challengeFixtures";
import {
  scheduledChallengeRouteAliases,
  type ScheduledChallengeRouteKey,
} from "@/data/mock/constants";
import { scheduledChallenges } from "@/data/mock/socialFixtures";
import type { ScheduledChallenge } from "@/types/game";

const routeById = new Map(
  Object.entries(scheduledChallengeRouteAliases).map(([routeKey, id]) => [
    id,
    routeKey as ScheduledChallengeRouteKey,
  ]),
);
const challengeVersionById = new Map(challengeVersions.map((version) => [version.id, version]));
const definitionById = new Map(
  challengeDefinitions.map((definition) => [definition.id, definition]),
);

/** @deprecated Proyección para la UI actual. Usa `mockDomainStore.scheduledChallenges`. */
export const demoSeasonScheduledChallenges: ScheduledChallenge[] = scheduledChallenges.map(
  (scheduledChallenge) => {
    const routeKey = routeById.get(scheduledChallenge.id);
    const version = challengeVersionById.get(scheduledChallenge.challengeVersionId);
    const definition = version ? definitionById.get(version.challengeDefinitionId) : undefined;
    if (!routeKey || !definition) {
      throw new Error(`Cannot project scheduled challenge "${scheduledChallenge.id}".`);
    }
    return {
      id: routeKey,
      number: scheduledChallenge.number,
      seasonId: "tabarnia-season-1",
      challengeDefinitionId: definition.slug,
      availableFrom: scheduledChallenge.opensAt,
      availableUntil: scheduledChallenge.closesAt,
    };
  },
);
