import type { AvatarTone } from "@/components/ui";
import { demoIdentity } from "@/data/mock/constants";
import { getPlayerRouteKey, resolveScheduledChallengeRouteKey } from "@/data/mock/selectors";
import { mockDomainStore } from "@/data/mock/store";
import type { Attempt, PlayerId } from "@/types/domain";

const tones: readonly AvatarTone[] = ["social", "coral", "blue", "aqua", "ink", "reward"];

export type CanonicalSocialPlayer = {
  id: string;
  displayName: string;
  initials: string;
  tone: AvatarTone;
};

export type CanonicalSocialRow = {
  player: CanonicalSocialPlayer;
  attempt: Attempt;
  score: number;
  timeUsed: number;
  correctAnswers: number;
  lastCorrectAt: number | null;
};

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const canonicalSocialPlayers: readonly CanonicalSocialPlayer[] =
  mockDomainStore.roomMemberships
    .filter((membership) => membership.status === "active" && membership.role !== "spectator")
    .map((membership, index) => {
      const player = mockDomainStore.players.find(({ id }) => id === membership.playerId);
      if (!player) throw new Error(`La membresía ${membership.id} no tiene jugador.`);
      return {
        id: getPlayerRouteKey(player.id) ?? player.id,
        displayName: player.displayName,
        initials: initials(player.displayName),
        tone: tones[index % tones.length],
      };
    });

export const canonicalCurrentPlayer = (() => {
  const routeKey = getPlayerRouteKey(demoIdentity.currentPlayerId);
  const player = canonicalSocialPlayers.find(({ id }) => id === routeKey);
  if (!player) throw new Error("El jugador actual no tiene una membresía competitiva activa.");
  return player;
})();

function isActiveCompetitivePlayer(playerId: PlayerId) {
  return mockDomainStore.roomMemberships.some(
    (membership) =>
      membership.playerId === playerId &&
      membership.status === "active" &&
      membership.role !== "spectator",
  );
}

function bestCompletedAttempts(challengeRouteKey: string) {
  const scheduledChallengeId = resolveScheduledChallengeRouteKey(challengeRouteKey);
  if (!scheduledChallengeId) return [];

  const bestByPlayer = new Map<PlayerId, Attempt>();
  for (const attempt of mockDomainStore.attempts) {
    if (
      attempt.scheduledChallengeId !== scheduledChallengeId ||
      attempt.kind !== "competitive" ||
      attempt.status !== "completed" ||
      attempt.score == null ||
      !isActiveCompetitivePlayer(attempt.playerId)
    ) {
      continue;
    }
    const current = bestByPlayer.get(attempt.playerId);
    if (!current || (current.score ?? -1) < attempt.score)
      bestByPlayer.set(attempt.playerId, attempt);
  }
  return [...bestByPlayer.values()];
}

export function getCanonicalSocialRows(
  challengeRouteKey: string,
  excludePlayerId: PlayerId | null = demoIdentity.currentPlayerId,
): CanonicalSocialRow[] {
  return bestCompletedAttempts(challengeRouteKey)
    .filter((attempt) => attempt.playerId !== excludePlayerId)
    .map((attempt) => {
      const routeKey = getPlayerRouteKey(attempt.playerId);
      const player = canonicalSocialPlayers.find(({ id }) => id === routeKey);
      if (!player) throw new Error(`El intento ${attempt.id} no tiene jugador social.`);
      const answers = mockDomainStore.attemptAnswers.filter(
        ({ attemptId }) => attemptId === attempt.id,
      );
      let elapsedMs = 0;
      let lastCorrectAt: number | null = null;
      for (const answer of answers) {
        elapsedMs += answer.timeUsedMs;
        if (answer.status === "correct") lastCorrectAt = elapsedMs / 1_000;
      }
      return {
        player,
        attempt,
        score: attempt.score ?? 0,
        timeUsed: elapsedMs / 1_000,
        correctAnswers: answers.filter(({ status }) => status === "correct").length,
        lastCorrectAt,
      };
    });
}

export function getCanonicalChallengeTitle(challengeRouteKey: string) {
  const scheduledChallengeId = resolveScheduledChallengeRouteKey(challengeRouteKey);
  const schedule = mockDomainStore.scheduledChallenges.find(
    ({ id }) => id === scheduledChallengeId,
  );
  const version = mockDomainStore.challengeVersions.find(
    ({ id }) => id === schedule?.challengeVersionId,
  );
  const definition = mockDomainStore.challengeDefinitions.find(
    ({ id }) => id === version?.challengeDefinitionId,
  );
  return { title: version?.title ?? "Desafío", subtitle: version?.subtitle ?? "", definition };
}
