import {
  getPlayerRouteKey,
  getRoomRouteKey,
  getScheduledChallengeRouteKey,
  selectChallengeRanking,
  selectRoomHistory,
  selectSeasonRanking,
} from "@/data/mock/selectors";
import { mockDomainStore, type MockDomainStore } from "@/data/mock/store";
import type { PlayerId, RoomId } from "@/types/domain";
import type { AnswerReview, RoomChallengeAttempt } from "@/types/gameplay";
import type { LegacyRoomSnapshot } from "@/types/legacy";
import type { RoomHistoryEntry } from "@/types/view-models";

const historyImages: Readonly<Record<string, string>> = {
  "tabarnia-flash-01": "/flash-pop/concepts/room-ready.webp",
  "tabarnia-challenge-02": "/flash-pop/concepts/alphabet-orbit.webp",
  "tabarnia-challenge-03": "/flash-pop/concepts/survival-last-beacon.webp",
  "tabarnia-challenge-04": "/flash-pop/concepts/narrative-story-trail.webp",
  "tabarnia-challenge-05": "/flash-pop/concepts/pyramid-soft-diorama.webp",
};

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return (parts.length > 1 ? parts.map((part) => part[0]).join("") : displayName.slice(0, 2))
    .toUpperCase()
    .slice(0, 2);
}

export function projectLegacyAttempt(
  attemptId: string,
  store: MockDomainStore,
): RoomChallengeAttempt | undefined {
  const attempt = store.attempts.find((candidate) => candidate.id === attemptId);
  if (!attempt || attempt.completedAt === null || attempt.score === null) return undefined;
  const challengeId = getScheduledChallengeRouteKey(attempt.scheduledChallengeId);
  if (!challengeId) return undefined;
  const schedule = store.scheduledChallenges.find(({ id }) => id === attempt.scheduledChallengeId);
  if (!schedule) return undefined;
  const items = store.challengeItems.filter(
    (item) => item.challengeVersionId === schedule.challengeVersionId,
  );
  const questionVersionById = new Map(
    store.questionVersions.map((version) => [version.id, version]),
  );
  const questionDefinitionById = new Map(
    store.questionDefinitions.map((definition) => [definition.id, definition]),
  );

  const answers = store.attemptAnswers
    .filter((answer) => answer.attemptId === attempt.id)
    .map((answer): AnswerReview => {
      const item = items.find((candidate) => candidate.id === answer.challengeItemId);
      const questionVersion = item ? questionVersionById.get(item.questionVersionId) : undefined;
      const definition = questionVersion
        ? questionDefinitionById.get(questionVersion.questionDefinitionId)
        : undefined;
      if (!definition) throw new Error(`Cannot project answer "${answer.id}".`);
      return {
        questionId: definition.slug,
        answer: answer.answer as AnswerReview["answer"],
        status: answer.status === "timeout" ? "unanswered" : answer.status,
        isCorrect: answer.status === "correct",
        points: answer.points,
        timeUsed: answer.timeUsedMs / 1_000,
        details: answer.resultDetails as AnswerReview["details"],
      };
    });

  return {
    challengeId,
    playedAt: attempt.completedAt,
    points: attempt.score,
    completed: true,
    answers,
  };
}

/** Reconstruye el agregado antiguo exclusivamente para consumidores aún no migrados. */
export function toLegacyRoomSnapshot(
  roomId: RoomId,
  currentPlayerId: PlayerId,
  store: MockDomainStore = mockDomainStore,
): LegacyRoomSnapshot | null {
  const room = store.rooms.find((candidate) => candidate.id === roomId);
  const season = store.seasons.find(
    (candidate) => candidate.roomId === roomId && candidate.status === "active",
  );
  const roomRouteKey = getRoomRouteKey(roomId);
  const currentPlayerRouteKey = getPlayerRouteKey(currentPlayerId);
  if (!room || !season || !roomRouteKey || !currentPlayerRouteKey) return null;

  const schedules = store.scheduledChallenges.filter((schedule) => schedule.seasonId === season.id);
  const totals = new Map(
    selectSeasonRanking(season.id, store).map((entry) => [entry.playerId, entry.points]),
  );
  const activeMemberships = store.roomMemberships.filter(
    (membership) => membership.roomId === roomId && membership.status === "active",
  );

  return {
    id: roomRouteKey,
    title: room.title,
    description: room.description,
    currentUserId: currentPlayerRouteKey,
    members: activeMemberships
      .map((membership) => {
        const player = store.players.find((candidate) => candidate.id === membership.playerId);
        const playerRouteKey = getPlayerRouteKey(membership.playerId);
        if (!player || !playerRouteKey) return null;
        return {
          id: playerRouteKey,
          name: player.displayName,
          initials: initials(player.displayName),
          avatarSrc: player.avatarPath ?? undefined,
          totalPoints: totals.get(player.id) ?? 0,
          challengeResults: Object.fromEntries(
            schedules.flatMap((schedule) => {
              const challengeId = getScheduledChallengeRouteKey(schedule.id);
              if (!challengeId) return [];
              const ranked = selectChallengeRanking(schedule.id, store).find(
                (entry) => entry.playerId === player.id,
              );
              const attempt = store.attempts.find(
                (candidate) =>
                  candidate.playerId === player.id &&
                  candidate.scheduledChallengeId === schedule.id &&
                  candidate.kind === "competitive" &&
                  candidate.status === "completed",
              );
              return [
                [
                  challengeId,
                  {
                    points: ranked?.points ?? 0,
                    completed: Boolean(attempt),
                    attempt: attempt ? projectLegacyAttempt(attempt.id, store) : undefined,
                  },
                ],
              ];
            }),
          ),
        };
      })
      .filter((member): member is NonNullable<typeof member> => member !== null),
    activeSeason: {
      id: "tabarnia-season-1",
      title: season.title,
      status: "active",
      scheduledChallenges: schedules.flatMap((schedule) => {
        const challengeId = getScheduledChallengeRouteKey(schedule.id);
        const version = store.challengeVersions.find(
          ({ id }) => id === schedule.challengeVersionId,
        );
        const definition = version
          ? store.challengeDefinitions.find(({ id }) => id === version.challengeDefinitionId)
          : undefined;
        return challengeId && definition
          ? [
              {
                id: challengeId,
                number: schedule.number,
                seasonId: "tabarnia-season-1",
                challengeDefinitionId: definition.slug,
                availableFrom: schedule.opensAt,
                availableUntil: schedule.closesAt,
              },
            ]
          : [];
      }),
    },
  };
}

export function toLegacyRoomHistory(
  roomId: RoomId,
  store: MockDomainStore = mockDomainStore,
): RoomHistoryEntry[] {
  return selectRoomHistory(roomId, store).flatMap((entry) => {
    const challengeId = getScheduledChallengeRouteKey(entry.scheduledChallenge.id);
    const version = store.challengeVersions.find(
      ({ id }) => id === entry.scheduledChallenge.challengeVersionId,
    );
    if (!challengeId || !version) return [];
    return [
      {
        id: `tabarnia-history-${String(entry.scheduledChallenge.number).padStart(2, "0")}`,
        challengeId,
        title: version.title,
        playedAt: entry.playedAt,
        imageSrc: historyImages[challengeId] ?? "/flash-pop/concepts/room-ready.webp",
        playerCount: entry.participantCount,
        ranking: entry.ranking.flatMap((ranked) => {
          const memberId = getPlayerRouteKey(ranked.playerId);
          return memberId ? [{ memberId, points: ranked.points }] : [];
        }),
      },
    ];
  });
}
