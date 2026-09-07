import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { demoRooms } from "@/data/demoRoom";
import { getDailyChallenge } from "@/lib/dailyChallenge";
import { getNextDailyBoundary } from "@/lib/dailyCountdown";
import {
  getChallengeImage,
  getChallengeQuestionCount,
} from "@/lib/roomCard";
import { getDailyLeaderboard, getRoomLeaderboard } from "@/lib/roomRankings";
import type { Room, RoomDetailModel } from "@/types/game";

export function getRoomById(roomId: string) {
  return demoRooms.find((room) => room.id === roomId);
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
      title: definition.title,
      subtitle: definition.subtitle,
      imageSrc: getChallengeImage(dailyChallenge.id),
      questionCount: getChallengeQuestionCount(definition),
      endsAt: getNextDailyBoundary(now).toISOString(),
      href: `/desafios/${dailyChallenge.id}`,
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
      totalPoints: member.totalPoints,
      roomRank: roomEntry.rank,
      dailyPoints: dailyEntry?.points ?? 0,
      dailyCompleted: dailyEntry?.completed ?? false,
    },
    dailyChallenge: dailyChallengeModel,
    roomLeaderboard,
    dailyLeaderboard,
  };
}
