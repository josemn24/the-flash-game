import type {
  ChallengeCompletion,
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomMemberDetailModel,
} from "@/types/game";
import { rankChallengeEntries } from "@/lib/challengeRanking";

function rankSeasonEntries<T extends { memberId: string; flashPoints: number }>(entries: T[]) {
  const ordered = [...entries].sort(
    (left, right) =>
      right.flashPoints - left.flashPoints || left.memberId.localeCompare(right.memberId),
  );
  return ordered.map((entry) => ({
    ...entry,
    rank: ordered.findIndex((candidate) => candidate.flashPoints === entry.flashPoints) + 1,
  }));
}

function rankChallengeEntriesWithStableOrder<
  T extends { memberId: string; flashPoints: number; durationMs: number; startedAt: string },
>(entries: T[]) {
  return rankChallengeEntries(entries).sort(
    (left, right) => left.rank - right.rank || left.memberId.localeCompare(right.memberId),
  );
}

export function applyRoomChallengeResult(
  model: RoomDetailModel,
  result: ChallengeCompletion,
): RoomDetailModel {
  if (result.roomId !== model.roomId || model.dailyChallenge?.id !== result.challengeId) {
    return model;
  }

  if (model.currentUser.dailyAttemptStatus !== "available") return model;

  if (!result.completed) {
    return {
      ...model,
      currentUser: {
        ...model.currentUser,
        dailyAttemptStatus: "notCompleted",
      },
    };
  }

  const totalFlashPoints =
    model.currentUser.totalFlashPoints - model.currentUser.dailyFlashPoints + result.flashPoints;
  const roomLeaderboard = rankSeasonEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.currentUser.id ? { ...entry, flashPoints: totalFlashPoints } : entry,
    ),
  );
  const currentDailyEntry = model.dailyLeaderboard.find(
    (entry) => entry.memberId === model.currentUser.id,
  );
  const dailyLeaderboard = rankChallengeEntriesWithStableOrder([
    ...model.dailyLeaderboard.filter((entry) => entry.memberId !== model.currentUser.id),
    currentDailyEntry
      ? {
          ...currentDailyEntry,
          flashPoints: result.flashPoints,
          completed: result.completed,
          durationMs: result.durationMs,
          startedAt: result.startedAt,
        }
      : {
          memberId: model.currentUser.id,
          name: model.currentUser.name,
          initials: model.currentUser.initials,
          avatarSrc: model.currentUser.avatarSrc,
          flashPoints: result.flashPoints,
          completed: result.completed,
          durationMs: result.durationMs,
          startedAt: result.startedAt,
          rank: 0,
        },
  ]);
  const roomEntry = roomLeaderboard.find((entry) => entry.memberId === model.currentUser.id);

  return {
    ...model,
    currentUser: {
      ...model.currentUser,
      totalFlashPoints,
      roomRank: roomEntry?.rank ?? model.currentUser.roomRank,
      dailyFlashPoints: result.flashPoints,
      dailyCompleted: result.completed,
      dailyAttemptStatus: result.completed ? "completed" : "notCompleted",
    },
    roomLeaderboard,
    dailyLeaderboard,
  };
}

function withRanks(model: Omit<RoomMemberDetailModel, "roomRank" | "challengeRank">) {
  const roomEntry = model.roomLeaderboard.find(({ memberId }) => memberId === model.member.id);
  const challengeEntry = model.challengeLeaderboard.find(
    ({ memberId }) => memberId === model.member.id,
  );

  return {
    ...model,
    roomRank: roomEntry?.rank ?? 0,
    challengeRank: challengeEntry?.rank ?? null,
  } satisfies RoomMemberDetailModel;
}

export function applyRoomMemberChallengeResult(
  model: RoomMemberDetailModel,
  result: ChallengeCompletion,
): RoomMemberDetailModel {
  if (result.roomId !== model.roomId || model.challengeSummary?.id !== result.challengeId) {
    return model;
  }

  if (model.result) return model;

  const previousFlashPoints = 0;
  const totalFlashPoints = model.member.totalFlashPoints - previousFlashPoints + result.flashPoints;
  const roomLeaderboard = rankSeasonEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.member.id ? { ...entry, flashPoints: totalFlashPoints } : entry,
    ),
  );
  const currentChallengeEntry = model.challengeLeaderboard.find(
    (entry) => entry.memberId === model.member.id,
  );
  const challengeLeaderboard = rankChallengeEntriesWithStableOrder([
    ...model.challengeLeaderboard.filter((entry) => entry.memberId !== model.member.id),
    currentChallengeEntry
      ? {
          ...currentChallengeEntry,
          flashPoints: result.flashPoints,
          completed: result.completed,
          durationMs: result.durationMs,
          startedAt: result.startedAt,
        }
      : {
          memberId: model.member.id,
          name: model.member.name,
          initials: model.member.initials,
          avatarSrc: model.member.avatarSrc,
          flashPoints: result.flashPoints,
          completed: result.completed,
          durationMs: result.durationMs,
          startedAt: result.startedAt,
          rank: 0,
        },
  ] satisfies RoomDailyLeaderboardEntry[]);

  return withRanks({
    ...model,
    member: { ...model.member, totalFlashPoints },
    result: {
      flashPoints: result.flashPoints,
      completed: result.completed,
      attempt: {
        challengeId: result.challengeId,
        startedAt: result.startedAt,
        playedAt: result.playedAt,
        durationMs: result.durationMs,
        flashPoints: result.flashPoints,
        completed: result.completed,
        answers: result.answers,
      },
    },
    roomLeaderboard,
    challengeLeaderboard,
  });
}
