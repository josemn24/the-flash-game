import type {
  ChallengeCompletion,
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomMemberDetailModel,
} from "@/types/game";

function sortEntries<T extends { memberId: string; flashPoints: number }>(entries: T[]) {
  return [...entries]
    .sort(
      (left, right) =>
        right.flashPoints - left.flashPoints || left.memberId.localeCompare(right.memberId),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function applyRoomChallengeResult(
  model: RoomDetailModel,
  result: ChallengeCompletion,
): RoomDetailModel {
  if (
    result.roomId !== model.roomId ||
    model.dailyChallenge?.id !== result.challengeId
  ) {
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
  const roomLeaderboard = sortEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.currentUser.id ? { ...entry, flashPoints: totalFlashPoints } : entry,
    ),
  );
  const currentDailyEntry = model.dailyLeaderboard.find(
    (entry) => entry.memberId === model.currentUser.id,
  );
  const dailyLeaderboard = sortEntries([
    ...model.dailyLeaderboard.filter((entry) => entry.memberId !== model.currentUser.id),
    currentDailyEntry
      ? {
          ...currentDailyEntry,
          flashPoints: result.flashPoints,
          completed: result.completed,
        }
      : {
          memberId: model.currentUser.id,
          name: model.currentUser.name,
          initials: model.currentUser.initials,
          avatarSrc: model.currentUser.avatarSrc,
          flashPoints: result.flashPoints,
          completed: result.completed,
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

function withRanks(model: Omit<RoomMemberDetailModel, "roomRank" | "dailyRank">) {
  const roomEntry = model.roomLeaderboard.find(({ memberId }) => memberId === model.member.id);
  const dailyEntry = model.dailyLeaderboard.find(({ memberId }) => memberId === model.member.id);

  return {
    ...model,
    roomRank: roomEntry?.rank ?? 0,
    dailyRank: dailyEntry?.rank ?? null,
  } satisfies RoomMemberDetailModel;
}

export function applyRoomMemberChallengeResult(
  model: RoomMemberDetailModel,
  result: ChallengeCompletion,
): RoomMemberDetailModel {
  if (result.roomId !== model.roomId || model.dailyChallenge?.id !== result.challengeId) {
    return model;
  }

  if (model.result) return model;

  const previousFlashPoints = 0;
  const totalFlashPoints = model.member.totalFlashPoints - previousFlashPoints + result.flashPoints;
  const roomLeaderboard = sortEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.member.id ? { ...entry, flashPoints: totalFlashPoints } : entry,
    ),
  );
  const currentDailyEntry = model.dailyLeaderboard.find(
    (entry) => entry.memberId === model.member.id,
  );
  const dailyLeaderboard = sortEntries([
    ...model.dailyLeaderboard.filter((entry) => entry.memberId !== model.member.id),
    currentDailyEntry
      ? {
          ...currentDailyEntry,
          flashPoints: result.flashPoints,
          completed: result.completed,
        }
      : {
          memberId: model.member.id,
          name: model.member.name,
          initials: model.member.initials,
          avatarSrc: model.member.avatarSrc,
          flashPoints: result.flashPoints,
          completed: result.completed,
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
        playedAt: result.playedAt,
        flashPoints: result.flashPoints,
        completed: result.completed,
        answers: result.answers,
      },
    },
    roomLeaderboard,
    dailyLeaderboard,
  });
}
