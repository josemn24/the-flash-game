import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { demoRooms } from "@/data/demoRoom";
import { getDailyChallenge } from "@/test-utils/legacy/dailyChallenge";
import {
  getChallengeDisplayTitle,
  getChallengeFormatLabel,
  getChallengeImage,
  getChallengeQuestionCount,
} from "@/test-utils/legacy/roomCard";
import { getDailyLeaderboard, getRoomLeaderboard } from "@/lib/roomRankings";
import type { ChallengeCompletion, Room, RoomDetailModel } from "@/types/game";
import type { CompetitiveAttemptStatus } from "@/types/game";

export function getRoomById(roomId: string) {
  return demoRooms.find((room) => room.id === roomId);
}

function sortLeaderboardEntries<T extends { memberId: string; flashPoints: number }>(entries: T[]) {
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
    model.dailyChallenge?.id !== result.challengeId ||
    !result.completed
  ) {
    return model;
  }

  const totalFlashPoints =
    model.currentUser.totalFlashPoints - model.currentUser.dailyFlashPoints + result.flashPoints;
  const roomLeaderboard = sortLeaderboardEntries(
    model.roomLeaderboard.map((entry) =>
      entry.memberId === model.currentUser.id ? { ...entry, flashPoints: totalFlashPoints } : entry,
    ),
  );
  const currentDailyEntry = model.dailyLeaderboard.find(
    (entry) => entry.memberId === model.currentUser.id,
  );
  const dailyLeaderboard = sortLeaderboardEntries([
    ...model.dailyLeaderboard.filter((entry) => entry.memberId !== model.currentUser.id),
    currentDailyEntry
      ? { ...currentDailyEntry, flashPoints: result.flashPoints, completed: result.completed }
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
    },
    roomLeaderboard,
    dailyLeaderboard,
  };
}

export function buildRoomDetailModel(room: Room, now = new Date()): RoomDetailModel {
  const roomLeaderboard = getRoomLeaderboard(room);
  const member = room.members.find(({ id }) => id === room.currentUserId);

  if (!member) {
    throw new Error(`Current user "${room.currentUserId}" is not a member of room "${room.id}".`);
  }

  const dailyChallenge = getDailyChallenge(room, now);
  let dailyChallengeModel: RoomDetailModel["dailyChallenge"] = null;
  let dailyLeaderboard: RoomDetailModel["dailyLeaderboard"] = [];

  if (dailyChallenge) {
    const definition = getChallengeDefinitionById(dailyChallenge.challengeDefinitionId);
    if (!definition) {
      throw new Error(`Missing challenge definition for daily challenge "${dailyChallenge.id}".`);
    }

    dailyLeaderboard = getDailyLeaderboard(room, dailyChallenge.id);
    dailyChallengeModel = {
      id: dailyChallenge.id,
      title: getChallengeDisplayTitle(definition),
      formatLabel: getChallengeFormatLabel(definition.mode),
      subtitle: definition.subtitle,
      imageSrc: getChallengeImage(dailyChallenge.id, definition.mode),
      questionCount: getChallengeQuestionCount(definition),
      endsAt: dailyChallenge.availableUntil,
      href: `/desafios/${dailyChallenge.id}?roomId=${encodeURIComponent(room.id)}`,
    };
  }

  const dailyEntry = dailyLeaderboard.find(({ memberId }) => memberId === member.id);
  const roomEntry = roomLeaderboard.find(({ memberId }) => memberId === member.id);

  if (!roomEntry) {
    throw new Error(`Current user "${member.id}" is missing from the room leaderboard.`);
  }

  return {
    roomId: room.id,
    title: room.title,
    seasonTitle: room.activeSeason.title,
    seasonStatus: room.activeSeason.status,
    currentUser: {
      id: member.id,
      name: member.name,
      initials: member.initials,
      avatarSrc: member.avatarSrc,
      totalFlashPoints: member.totalFlashPoints,
      roomRank: roomEntry.rank,
    dailyFlashPoints: dailyEntry?.flashPoints ?? 0,
    dailyCompleted: dailyEntry?.completed ?? false,
    dailyAttemptStatus: dailyEntry?.completed ? "completed" : ("available" as CompetitiveAttemptStatus),
    },
    dailyChallenge: dailyChallengeModel,
    roomLeaderboard,
    dailyLeaderboard,
  };
}
