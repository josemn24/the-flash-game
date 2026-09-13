import type {
  Room,
  RoomDailyLeaderboardEntry,
  RoomHistoryEntry,
  RoomLeaderboardEntry,
  RoomMember,
} from "@/types/game";

function sharedRank<T>(ordered: readonly T[], index: number, pointsFor: (entry: T) => number) {
  const points = pointsFor(ordered[index]);
  return ordered.findIndex((entry) => pointsFor(entry) === points) + 1;
}

function buildLeaderboard(
  members: RoomMember[],
  getFlashPoints: (member: RoomMember) => number,
): RoomLeaderboardEntry[] {
  const ordered = [...members].sort(
    (left, right) =>
      getFlashPoints(right) - getFlashPoints(left) || left.id.localeCompare(right.id),
  );
  return ordered.map((member, index) => ({
    rank: sharedRank(ordered, index, getFlashPoints),
    memberId: member.id,
    name: member.name,
    initials: member.initials,
    avatarSrc: member.avatarSrc,
    flashPoints: getFlashPoints(member),
  }));
}

export function getRoomLeaderboard(room: Room) {
  return buildLeaderboard(room.members, (member) => member.totalFlashPoints);
}

export function getDailyLeaderboard(room: Room, challengeId: string) {
  const ordered = room.members
    .filter((member) => member.challengeResults[challengeId]?.completed)
    .sort(
      (left, right) =>
        (right.challengeResults[challengeId]?.flashPoints ?? 0) -
          (left.challengeResults[challengeId]?.flashPoints ?? 0) || left.id.localeCompare(right.id),
    );
  return ordered.map((member, index): RoomDailyLeaderboardEntry => ({
    rank: sharedRank(
      ordered,
      index,
      (entry) => entry.challengeResults[challengeId]?.flashPoints ?? 0,
    ),
    memberId: member.id,
    name: member.name,
    initials: member.initials,
    avatarSrc: member.avatarSrc,
    flashPoints: member.challengeResults[challengeId]?.flashPoints ?? 0,
    completed: true,
  }));
}

export function getHistoryLeaderboard(room: Room, entry: RoomHistoryEntry) {
  if (!entry.ranking) {
    return getDailyLeaderboard(room, entry.challengeId);
  }

  const flashPointsByMemberId = new Map(
    entry.ranking.map((result) => [result.memberId, result.flashPoints]),
  );

  const ordered = room.members
    .filter((member) => flashPointsByMemberId.has(member.id))
    .sort(
      (left, right) =>
        (flashPointsByMemberId.get(right.id) ?? 0) - (flashPointsByMemberId.get(left.id) ?? 0) ||
        left.id.localeCompare(right.id),
    );
  return ordered.map((member, index): RoomDailyLeaderboardEntry => ({
    rank: sharedRank(ordered, index, (entry) => flashPointsByMemberId.get(entry.id) ?? 0),
    memberId: member.id,
    name: member.name,
    initials: member.initials,
    avatarSrc: member.avatarSrc,
    flashPoints: flashPointsByMemberId.get(member.id) ?? 0,
    completed: true,
  }));
}
