import type {
  ChallengeCompletion,
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomMemberDetailModel,
} from "@/types/game";

function sortEntries<T extends { memberId: string; points: number }>(entries: T[]) {
  return [...entries]
    .sort(
      (left, right) => right.points - left.points || left.memberId.localeCompare(right.memberId),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function applyRoomChallengeResult(
  model: RoomDetailModel,
  result: ChallengeCompletion,
): RoomDetailModel {
  if (
    result.roomId !== model.roomId ||
    model.dailyChallenge?.id !== result.challengeId ||
    !result.completed
  ) {
    return model;
  }

  const totalPoints = model.currentUser.totalPoints - model.currentUser.dailyPoints + result.points;
  const roomLeaderboard = sortEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.currentUser.id ? { ...entry, points: totalPoints } : entry,
    ),
  );
  const currentDailyEntry = model.dailyLeaderboard.find(
    (entry) => entry.memberId === model.currentUser.id,
  );
  const dailyLeaderboard = sortEntries([
    ...model.dailyLeaderboard.filter((entry) => entry.memberId !== model.currentUser.id),
    currentDailyEntry
      ? { ...currentDailyEntry, points: result.points, completed: result.completed }
      : {
          memberId: model.currentUser.id,
          name: model.currentUser.name,
          initials: model.currentUser.initials,
          avatarSrc: model.currentUser.avatarSrc,
          points: result.points,
          completed: result.completed,
          rank: 0,
        },
  ]);
  const roomEntry = roomLeaderboard.find((entry) => entry.memberId === model.currentUser.id);

  return {
    ...model,
    currentUser: {
      ...model.currentUser,
      totalPoints,
      roomRank: roomEntry?.rank ?? model.currentUser.roomRank,
      dailyPoints: result.points,
      dailyCompleted: result.completed,
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

  const previousPoints = model.result?.points ?? 0;
  const totalPoints = model.member.totalPoints - previousPoints + result.points;
  const roomLeaderboard = sortEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.member.id ? { ...entry, points: totalPoints } : entry,
    ),
  );
  const currentDailyEntry = model.dailyLeaderboard.find(
    (entry) => entry.memberId === model.member.id,
  );
  const dailyLeaderboard = sortEntries([
    ...model.dailyLeaderboard.filter((entry) => entry.memberId !== model.member.id),
    currentDailyEntry
      ? { ...currentDailyEntry, points: result.points, completed: result.completed }
      : {
          memberId: model.member.id,
          name: model.member.name,
          initials: model.member.initials,
          avatarSrc: model.member.avatarSrc,
          points: result.points,
          completed: result.completed,
          rank: 0,
        },
  ] satisfies RoomDailyLeaderboardEntry[]);

  return withRanks({
    ...model,
    member: { ...model.member, totalPoints },
    result: {
      points: result.points,
      completed: result.completed,
      attempt: {
        challengeId: result.challengeId,
        playedAt: result.playedAt,
        points: result.points,
        completed: result.completed,
        answers: result.answers,
      },
    },
    roomLeaderboard,
    dailyLeaderboard,
  });
}
