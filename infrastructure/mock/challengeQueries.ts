import type { ChallengeQueries } from "@/application/queries";
import { legacyChallenges } from "@/data/mock/legacyChallengeAdapter";
import {
  getPlayerRouteKey,
  resolveRoomRouteKey,
  resolveScheduledChallengeRouteKey,
} from "@/data/mock/selectors";
import type { DomainStore, PlayerId } from "@/types/domain";
import type {
  FlashPopSocialPlayerModel,
  FlashPopSocialSnapshot,
  QueryContext,
} from "@/types/view-models";

const PRIMARY_CHALLENGE_KEY = "tabarnia-challenge-05";
const SECONDARY_CHALLENGE_KEY = "tabarnia-challenge-06";
const tones = ["social", "coral", "blue", "aqua", "ink", "reward"] as const;

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export class MockChallengeQueries implements ChallengeQueries {
  constructor(private readonly store: DomainStore) {}

  private socialSnapshot(challengeKey: string, viewerId: PlayerId): FlashPopSocialSnapshot {
    const scheduledChallengeId = resolveScheduledChallengeRouteKey(challengeKey);
    const schedule = scheduledChallengeId
      ? this.store.scheduledChallenges.find(({ id }) => id === scheduledChallengeId)
      : undefined;
    const season = schedule
      ? this.store.seasons.find(({ id }) => id === schedule.seasonId)
      : undefined;
    const memberships = season
      ? this.store.roomMemberships.filter(
          (membership) =>
            membership.roomId === season.roomId &&
            membership.status === "active" &&
            membership.role !== "spectator",
        )
      : [];
    const players = memberships.map((membership, index): FlashPopSocialPlayerModel => {
      const player = this.store.players.find(({ id }) => id === membership.playerId);
      const routeKey = getPlayerRouteKey(membership.playerId);
      if (!player || !routeKey) throw new Error(`Missing social player for "${membership.id}".`);
      return {
        id: routeKey,
        displayName: player.displayName,
        initials: initials(player.displayName),
        tone: tones[index % tones.length]!,
      };
    });
    const currentKey = getPlayerRouteKey(viewerId);
    const currentPlayer = players.find(({ id }) => id === currentKey);
    if (!currentPlayer) throw new Error("The viewer has no competitive social projection.");
    const activePlayerIds = new Set(memberships.map(({ playerId }) => playerId));

    const bestByPlayer = new Map<PlayerId, (typeof this.store.attempts)[number]>();
    for (const attempt of this.store.attempts) {
      if (
        attempt.scheduledChallengeId !== scheduledChallengeId ||
        attempt.playerId === viewerId ||
        !activePlayerIds.has(attempt.playerId) ||
        attempt.kind !== "competitive" ||
        attempt.status !== "completed" ||
        attempt.score === null
      ) {
        continue;
      }
      const current = bestByPlayer.get(attempt.playerId);
      if (!current || (current.score ?? -1) < attempt.score)
        bestByPlayer.set(attempt.playerId, attempt);
    }
    const peers = [...bestByPlayer.values()].map((attempt) => {
      const routeKey = getPlayerRouteKey(attempt.playerId);
      const player = players.find(({ id }) => id === routeKey);
      if (!player || !attempt.completedAt)
        throw new Error(`Missing social attempt data for "${attempt.id}".`);
      const answers = this.store.attemptAnswers.filter(({ attemptId }) => attemptId === attempt.id);
      let elapsedMs = 0;
      let lastCorrectAt: number | null = null;
      for (const answer of answers) {
        elapsedMs += answer.timeUsedMs;
        if (answer.status === "correct") lastCorrectAt = elapsedMs / 1_000;
      }
      return {
        player,
        score: attempt.score ?? 0,
        timeUsed: elapsedMs / 1_000,
        correctAnswers: answers.filter(({ status }) => status === "correct").length,
        lastCorrectAt,
        completedAt: attempt.completedAt,
      };
    });
    return { currentPlayer, players, peers };
  }

  async getPlayable(challengeKey: string, roomKey: string | null, context: QueryContext) {
    const challenge = legacyChallenges.find(({ id }) => id === challengeKey);
    if (!challenge) return null;
    const scheduledChallengeId = resolveScheduledChallengeRouteKey(challengeKey);
    const schedule = scheduledChallengeId
      ? this.store.scheduledChallenges.find(({ id }) => id === scheduledChallengeId)
      : undefined;
    if (!schedule) return null;
    let roomContext;
    if (roomKey !== null) {
      const roomId = resolveRoomRouteKey(roomKey);
      const season = this.store.seasons.find(({ id }) => id === schedule.seasonId);
      const room = roomId ? this.store.rooms.find(({ id }) => id === roomId) : undefined;
      const membership = room
        ? this.store.roomMemberships.find(
            (candidate) =>
              candidate.roomId === room.id &&
              candidate.playerId === context.viewerId &&
              candidate.status === "active" &&
              candidate.role !== "spectator",
          )
        : undefined;
      if (!room || !season || season.roomId !== room.id || !membership) return null;
      roomContext = { roomId: roomKey, roomTitle: room.title, returnTo: `/salas/${roomKey}` };
    }
    return {
      challenge,
      roomContext,
      socialSnapshot: this.socialSnapshot(challengeKey, context.viewerId),
    };
  }

  async getFlashPopLobby(context: QueryContext) {
    const [primary, secondary] = await Promise.all([
      this.getPlayable(PRIMARY_CHALLENGE_KEY, null, context),
      this.getPlayable(SECONDARY_CHALLENGE_KEY, null, context),
    ]);
    if (!primary || !secondary) throw new Error("The Flash Pop lobby challenges are missing.");
    const viewer = this.store.players.find(({ id }) => id === context.viewerId);
    const viewerKey = getPlayerRouteKey(context.viewerId);
    if (!viewer || !viewerKey) throw new Error("The Flash Pop lobby viewer is missing.");
    return {
      primary,
      secondary,
      currentViewer: {
        id: viewerKey,
        name: viewer.displayName,
        avatarSrc: viewer.avatarPath ?? undefined,
      },
    };
  }
}
