import type {
  Room,
  RoomDailyLeaderboardEntry,
  RoomHistoryEntry,
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
      avatarSrc: member.avatarSrc,
      points: getPoints(member),
    }));
}

export function getRoomLeaderboard(room: Room) {
  return buildLeaderboard(room.members, (member) => member.totalPoints);
}

export function getDailyLeaderboard(room: Room, challengeId: string) {
  return room.members
    .filter((member) => member.challengeResults[challengeId]?.completed)
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
      avatarSrc: member.avatarSrc,
      points: member.challengeResults[challengeId]?.points ?? 0,
      completed: true,
    }));
}

export function getHistoryLeaderboard(room: Room, entry: RoomHistoryEntry) {
  if (!entry.ranking) {
    return getDailyLeaderboard(room, entry.challengeId);
  }

  const pointsByMemberId = new Map(entry.ranking.map((result) => [result.memberId, result.points]));

  return room.members
    .filter((member) => pointsByMemberId.has(member.id))
    .sort(
      (left, right) =>
        (pointsByMemberId.get(right.id) ?? 0) - (pointsByMemberId.get(left.id) ?? 0) ||
        left.id.localeCompare(right.id),
    )
    .map((member, index): RoomDailyLeaderboardEntry => ({
      rank: index + 1,
      memberId: member.id,
      name: member.name,
      initials: member.initials,
      avatarSrc: member.avatarSrc,
      points: pointsByMemberId.get(member.id) ?? 0,
      completed: true,
    }));
}
