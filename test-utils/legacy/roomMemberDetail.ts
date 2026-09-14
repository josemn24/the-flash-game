import { getChallengeById } from "@/data/challenges";
import { buildRoomDetailModel } from "@/test-utils/legacy/roomDetail";
import { buildMockRoomChallengeAttempt } from "@/test-utils/legacy/roomAttempts";
import type {
  ChallengeCompletion,
  Room,
  RoomDailyLeaderboardEntry,
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
  T extends {
    memberId: string;
    flashPoints: number;
    durationMs: number;
    startedAt: string;
  },
>(entries: T[]) {
  return rankChallengeEntries(entries).sort(
    (left, right) => left.rank - right.rank || left.memberId.localeCompare(right.memberId),
  );
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
  const result =
    baseResult && roomModel.dailyChallenge
      ? {
          ...baseResult,
          attempt: buildMockRoomChallengeAttempt(roomModel.dailyChallenge.id, baseResult, {
            seed: member.id,
          }),
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

  const previousFlashPoints = model.result?.flashPoints ?? 0;
  const totalFlashPoints = model.member.totalFlashPoints - previousFlashPoints + result.flashPoints;
  const roomLeaderboard = rankSeasonEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.member.id ? { ...entry, flashPoints: totalFlashPoints } : entry,
    ),
  );
  const currentDailyEntry = model.dailyLeaderboard.find(
    (entry) => entry.memberId === model.member.id,
  );
  const dailyLeaderboard = rankChallengeEntriesWithStableOrder([
    ...model.dailyLeaderboard.filter((entry) => entry.memberId !== model.member.id),
    currentDailyEntry
      ? {
          ...currentDailyEntry,
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
    dailyLeaderboard,
  });
}
