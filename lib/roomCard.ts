import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { getDailyChallenge } from "@/lib/dailyChallenge";
import { getRoomLeaderboard } from "@/lib/roomRankings";
import type { ChallengeDefinition, Room, RoomCardModel } from "@/types/game";

export const ROOM_ART_FALLBACK = "/flash-pop/concepts/pyramid-soft-diorama.webp";

export function getChallengeQuestionCount(definition: ChallengeDefinition) {
  if (definition.mode === "alphabet") return definition.entries.length;
  if (definition.mode === "narrative") {
    return definition.beats.reduce(
      (count, beat) => count + beat.steps.filter((step) => step.type === "question").length,
      0,
    );
  }
  if (definition.mode === "pyramid") return definition.levels.length;
  return definition.questionIds.length;
}

export function getChallengeImage(challengeId: string) {
  if (challengeId === "tabarnia-challenge-05") {
    return "/flash-pop/concepts/pyramid-electric-arena.webp";
  }

  if (challengeId === "tabarnia-challenge-06") {
    return "/flash-pop/concepts/pyramid-graphic-voltage.webp";
  }

  return ROOM_ART_FALLBACK;
}

export function buildRoomCardModel(room: Room, now = new Date()): RoomCardModel {
  const dailyChallenge = getDailyChallenge(room, now);
  const leaderboard = getRoomLeaderboard(room);
  const currentUser = leaderboard.find((entry) => entry.memberId === room.currentUserId);

  if (!currentUser) {
    throw new Error(`Current user "${room.currentUserId}" is not a member of room "${room.id}".`);
  }

  let dailyChallengeModel: RoomCardModel["dailyChallenge"] = null;
  if (dailyChallenge) {
    const definition = getChallengeDefinitionById(dailyChallenge.challengeDefinitionId);
    if (!definition) {
      throw new Error(`Missing challenge definition for daily challenge "${dailyChallenge.id}".`);
    }

    dailyChallengeModel = {
      id: dailyChallenge.id,
      title: definition.title,
      subtitle: definition.subtitle,
      availableUntil: dailyChallenge.availableUntil,
      questionCount: getChallengeQuestionCount(definition),
      imageSrc: getChallengeImage(dailyChallenge.id),
    };
  }

  return {
    roomId: room.id,
    title: room.title,
    seasonTitle: room.activeSeason.title,
    seasonStatus: room.activeSeason.status,
    dailyChallenge: dailyChallengeModel,
    currentUser: {
      totalPoints: currentUser.points,
      roomRank: currentUser.rank,
    },
    memberPreviews: room.members.slice(0, 4).map(({ id, name, initials }) => ({
      id,
      name,
      initials,
    })),
    memberCount: room.members.length,
    href: `/salas/${room.id}`,
  };
}
