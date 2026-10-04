import {
  playerRouteAliases,
  mockRoomKeys,
  scheduledChallengeRouteAliases,
  type PlayerRouteKey,
  type MockRoomKey,
  type ScheduledChallengeRouteKey,
} from "@/data/mock/constants";
import { mockDomainStore, type MockDomainStore } from "@/data/mock/store";
import { getPublicationEffectiveStatus } from "@/lib/rooms/publicationStatus";
import {
  compareChallengeRankingMetrics,
  rankChallengeEntries,
  sumEffectiveDurationMs,
  type ChallengeRankingMetrics,
} from "@/lib/challengeRanking";
import type {
  Attempt,
  PlayerId,
  RoomId,
  ScheduledChallenge,
  ScheduledChallengeId,
  SeasonId,
} from "@/types/domain";

function reverseAliases<Value extends string>(aliases: Readonly<Record<string, Value>>) {
  return new Map(Object.entries(aliases).map(([routeKey, id]) => [id, routeKey]));
}

const mockRoomKeyById = reverseAliases(mockRoomKeys);
const playerRouteById = reverseAliases(playerRouteAliases);
const scheduledChallengeRouteById = reverseAliases(scheduledChallengeRouteAliases);

export function resolveMockRoomKey(roomKey: string): RoomId | null {
  return mockRoomKeys[roomKey as MockRoomKey] ?? null;
}

export function resolvePlayerRouteKey(routeKey: string): PlayerId | null {
  return playerRouteAliases[routeKey as PlayerRouteKey] ?? null;
}

export function resolveScheduledChallengeRouteKey(routeKey: string): ScheduledChallengeId | null {
  return scheduledChallengeRouteAliases[routeKey as ScheduledChallengeRouteKey] ?? null;
}

export function getMockRoomKey(id: RoomId): MockRoomKey | null {
  return (mockRoomKeyById.get(id) as MockRoomKey | undefined) ?? null;
}

export function getPlayerRouteKey(id: PlayerId): PlayerRouteKey | null {
  return (playerRouteById.get(id) as PlayerRouteKey | undefined) ?? null;
}

export function getScheduledChallengeRouteKey(
  id: ScheduledChallengeId,
): ScheduledChallengeRouteKey | null {
  return (scheduledChallengeRouteById.get(id) as ScheduledChallengeRouteKey | undefined) ?? null;
}

export function selectRoom(id: RoomId, store: MockDomainStore = mockDomainStore) {
  return store.rooms.find((room) => room.id === id) ?? null;
}

export function selectActiveSeason(roomId: RoomId, store: MockDomainStore = mockDomainStore) {
  return (
    store.seasons.find((season) => season.roomId === roomId && season.status === "active") ?? null
  );
}

export function selectOpenScheduledChallenge(
  seasonId: SeasonId,
  now: Date,
  store: MockDomainStore = mockDomainStore,
): ScheduledChallenge | null {
  const timestamp = now.getTime();
  return (
    store.scheduledChallenges.find(
      (schedule) =>
        schedule.seasonId === seasonId &&
        schedule.status === "open" &&
        Date.parse(schedule.opensAt) <= timestamp &&
        timestamp < Date.parse(schedule.closesAt),
    ) ?? null
  );
}

function isSuperadmin(playerId: PlayerId, store: MockDomainStore) {
  return store.platformRoleAssignments.some(
    (assignment) => assignment.playerId === playerId && assignment.role === "superadmin",
  );
}

function isCompetitiveParticipant(
  playerId: PlayerId,
  roomId: RoomId,
  store: MockDomainStore,
  at?: string,
) {
  const membership = store.roomMemberships.find(
    (candidate) => candidate.roomId === roomId && candidate.playerId === playerId,
  );
  if (!membership || membership.role === "spectator" || isSuperadmin(playerId, store)) return false;
  if (!at) return membership.status === "active";
  return membership.joinedAt <= at && (membership.endedAt === null || at <= membership.endedAt);
}

function bestCompletedAttempts(
  scheduledChallengeIds: ReadonlySet<ScheduledChallengeId>,
  store: MockDomainStore,
) {
  const bestByPlayerAndChallenge = new Map<string, Attempt>();
  for (const attempt of store.attempts) {
    if (
      !scheduledChallengeIds.has(attempt.scheduledChallengeId) ||
      attempt.kind !== "competitive" ||
      attempt.status !== "completed" ||
      attempt.score == null
    ) {
      continue;
    }
    const key = `${attempt.playerId}:${attempt.scheduledChallengeId}`;
    const current = bestByPlayerAndChallenge.get(key);
    if (
      !current ||
      compareChallengeRankingMetrics(
        attemptRankingMetrics(attempt, store),
        attemptRankingMetrics(current, store),
      ) < 0
    )
      bestByPlayerAndChallenge.set(key, attempt);
  }
  return [...bestByPlayerAndChallenge.values()];
}

function attemptRankingMetrics(attempt: Attempt, store: MockDomainStore): ChallengeRankingMetrics {
  return {
    flashPoints: attempt.score ?? 0,
    durationMs: sumEffectiveDurationMs(
      store.attemptAnswers.filter(({ attemptId }) => attemptId === attempt.id),
    ),
    startedAt: attempt.startedAt,
  };
}

export type MockRankingEntry = {
  readonly rank: number;
  readonly playerId: PlayerId;
  readonly flashPoints: number;
};

export type MockChallengeRankingEntry = MockRankingEntry & {
  readonly durationMs: number;
  readonly startedAt: string;
};

function rankChallengeEntriesWithStableOrder(
  entries: Omit<MockChallengeRankingEntry, "rank">[],
): MockChallengeRankingEntry[] {
  const ordered = rankChallengeEntries(entries).sort(
    (left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId),
  );
  return ordered;
}

function rankSeasonEntries(
  entries: Array<Pick<MockRankingEntry, "playerId" | "flashPoints">>,
): MockRankingEntry[] {
  const ordered = [...entries].sort(
    (left, right) =>
      right.flashPoints - left.flashPoints || left.playerId.localeCompare(right.playerId),
  );
  return ordered.map((entry) => ({
    ...entry,
    rank: ordered.findIndex((candidate) => candidate.flashPoints === entry.flashPoints) + 1,
  }));
}

export function selectChallengeRanking(
  scheduledChallengeId: ScheduledChallengeId,
  store: MockDomainStore = mockDomainStore,
) {
  const schedule = store.scheduledChallenges.find(({ id }) => id === scheduledChallengeId);
  const season = schedule ? store.seasons.find(({ id }) => id === schedule.seasonId) : undefined;
  if (!season || schedule?.status === "cancelled") return [];
  return rankChallengeEntriesWithStableOrder(
    bestCompletedAttempts(new Set([scheduledChallengeId]), store)
      .filter((attempt) =>
        isCompetitiveParticipant(attempt.playerId, season.roomId, store, attempt.startedAt),
      )
      .map((attempt) => ({
        playerId: attempt.playerId,
        ...attemptRankingMetrics(attempt, store),
      })),
  );
}

export function selectBestCompletedAttempt(
  playerId: PlayerId,
  scheduledChallengeId: ScheduledChallengeId,
  store: MockDomainStore = mockDomainStore,
) {
  return bestCompletedAttempts(new Set([scheduledChallengeId]), store).find(
    (attempt) => attempt.playerId === playerId,
  );
}

export function selectSeasonRanking(seasonId: SeasonId, store: MockDomainStore = mockDomainStore) {
  const season = store.seasons.find(({ id }) => id === seasonId);
  if (!season) return [];
  const scheduleIds = new Set(
    store.scheduledChallenges
      .filter((schedule) => schedule.seasonId === seasonId && schedule.status !== "cancelled")
      .map((schedule) => schedule.id),
  );
  const totals = new Map<PlayerId, number>();
  for (const attempt of bestCompletedAttempts(scheduleIds, store)) {
    if (!isCompetitiveParticipant(attempt.playerId, season.roomId, store, attempt.startedAt))
      continue;
    totals.set(attempt.playerId, (totals.get(attempt.playerId) ?? 0) + (attempt.score ?? 0));
  }
  return rankSeasonEntries(
    [...totals].map(([playerId, flashPoints]) => ({ playerId, flashPoints })),
  );
}

export type MockHistoryEntry = {
  readonly scheduledChallenge: ScheduledChallenge;
  readonly playedAt: string;
  readonly participantCount: number;
  readonly ranking: readonly MockChallengeRankingEntry[];
};

export function selectRoomHistory(
  roomId: RoomId,
  store: MockDomainStore = mockDomainStore,
  now: Date = new Date(),
): readonly MockHistoryEntry[] {
  const seasons = new Map(
    store.seasons
      .filter(
        (season) =>
          season.roomId === roomId && (season.status === "active" || season.status === "finished"),
      )
      .map((season) => [season.id, season]),
  );
  return store.scheduledChallenges
    .filter((schedule) => {
      const season = seasons.get(schedule.seasonId);
      return (
        season &&
        getPublicationEffectiveStatus(schedule, season, now) === "closed" &&
        !store.attempts.some(
          (attempt) =>
            attempt.scheduledChallengeId === schedule.id && attempt.status === "in_progress",
        )
      );
    })
    .map((scheduledChallenge) => {
      const ranking = selectChallengeRanking(scheduledChallenge.id, store);
      const participantIds = new Set(
        store.attempts
          .filter(
            (attempt) =>
              attempt.scheduledChallengeId === scheduledChallenge.id &&
              attempt.kind === "competitive" &&
              (attempt.status === "completed" || attempt.status === "abandoned") &&
              isCompetitiveParticipant(attempt.playerId, roomId, store, attempt.startedAt),
          )
          .map(({ playerId }) => playerId),
      );
      const completedAt = store.attempts
        .filter(
          (attempt) =>
            attempt.scheduledChallengeId === scheduledChallenge.id &&
            attempt.kind === "competitive" &&
            (attempt.status === "completed" || attempt.status === "abandoned") &&
            attempt.completedAt !== null,
        )
        .map((attempt) => attempt.completedAt as string)
        .sort()
        .at(-1);
      return {
        scheduledChallenge,
        playedAt: completedAt ?? scheduledChallenge.closesAt,
        participantCount: participantIds.size,
        ranking,
      };
    })
    .sort((left, right) => right.playedAt.localeCompare(left.playedAt));
}
