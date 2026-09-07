import type {
  Room,
  RoomDailyLeaderboardEntry,
  RoomLeaderboardEntry,
  RoomMember,
} from "@/types/game";

function buildLeaderboard(
  members: RoomMember[],
  getPoints: (member: RoomMember) => number,
): RoomLeaderboardEntry[] {
  return [...members]
    .sort((left, right) => getPoints(right) - getPoints(left) || left.id.localeCompare(right.id))
    .map((member, index) => ({
      rank: index + 1,
      memberId: member.id,
      name: member.name,
      initials: member.initials,
      points: getPoints(member),
    }));
}

export function getRoomLeaderboard(room: Room) {
  return buildLeaderboard(room.members, (member) => member.totalPoints);
}

export function getDailyLeaderboard(room: Room, challengeId: string) {
  return [...room.members]
    .sort(
      (left, right) =>
        (right.challengeResults[challengeId]?.points ?? 0) -
          (left.challengeResults[challengeId]?.points ?? 0) || left.id.localeCompare(right.id),
    )
    .map((member, index): RoomDailyLeaderboardEntry => ({
      rank: index + 1,
      memberId: member.id,
      name: member.name,
      initials: member.initials,
      points: member.challengeResults[challengeId]?.points ?? 0,
      completed: member.challengeResults[challengeId]?.completed ?? false,
    }));
}
