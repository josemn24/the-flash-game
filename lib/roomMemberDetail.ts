import { getChallengeById } from "@/data/challenges";
import { buildRoomDetailModel } from "@/lib/roomDetail";
import { buildMockRoomChallengeAttempt } from "@/lib/roomAttempts";
import type {
  ChallengeCompletion,
  Room,
  RoomDailyLeaderboardEntry,
  RoomMemberDetailModel,
} from "@/types/game";

function sortEntries<T extends { memberId: string; points: number }>(entries: T[]) {
  return [...entries]
    .sort((left, right) => right.points - left.points || left.memberId.localeCompare(right.memberId))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
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

export function buildRoomMemberDetailModel(
  room: Room,
  memberId: string,
  now = new Date(),
): RoomMemberDetailModel | null {
  const member = room.members.find((candidate) => candidate.id === memberId);
  if (!member) return null;

  const roomModel = buildRoomDetailModel(room, now);
  const baseResult = roomModel.dailyChallenge
    ? (member.challengeResults[roomModel.dailyChallenge.id] ?? null)
    : null;
  const result = baseResult && roomModel.dailyChallenge
    ? {
        ...baseResult,
        attempt: buildMockRoomChallengeAttempt(roomModel.dailyChallenge.id, baseResult),
      }
    : baseResult;

  return withRanks({
    roomId: room.id,
    roomTitle: room.title,
    member,
    dailyChallenge: roomModel.dailyChallenge,
    challenge: roomModel.dailyChallenge
      ? (getChallengeById(roomModel.dailyChallenge.id) ?? null)
      : null,
    result,
    roomLeaderboard: roomModel.roomLeaderboard,
    dailyLeaderboard: roomModel.dailyLeaderboard,
  });
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
