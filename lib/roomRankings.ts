import type {
  Room,
  RoomDailyLeaderboardEntry,
  RoomHistoryEntry,
  RoomLeaderboardEntry,
  RoomMember,
} from "@/types/game";
import { rankChallengeEntries } from "@/lib/challengeRanking";

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
  const entries = room.members
    .filter((member) => member.challengeResults[challengeId]?.completed)
    .map((member) => {
      const result = member.challengeResults[challengeId];
      return {
        member,
        flashPoints: result?.flashPoints ?? 0,
        durationMs: result?.attempt?.durationMs ?? Number.MAX_SAFE_INTEGER,
        startedAt: result?.attempt?.startedAt ?? "9999-12-31T23:59:59.999Z",
      };
    });
  return rankChallengeEntries(entries).map(
    ({ member, flashPoints, durationMs, startedAt, rank }): RoomDailyLeaderboardEntry => ({
      rank,
      memberId: member.id,
      name: member.name,
      initials: member.initials,
      avatarSrc: member.avatarSrc,
      flashPoints,
      completed: true,
      durationMs,
      startedAt,
    }),
  );
}

export function getHistoryLeaderboard(room: Room, entry: RoomHistoryEntry) {
  if (!entry.ranking) {
    return getDailyLeaderboard(room, entry.challengeId);
  }

  const flashPointsByMemberId = new Map(
    entry.ranking.map((result) => [result.memberId, result.flashPoints]),
  );

  const entries = room.members
    .filter((member) => flashPointsByMemberId.has(member.id))
    .map((member) => {
      const result = entry.ranking?.find(({ memberId }) => memberId === member.id);
      return {
        member,
        flashPoints: flashPointsByMemberId.get(member.id) ?? 0,
        durationMs: result?.durationMs ?? Number.MAX_SAFE_INTEGER,
        startedAt: result?.startedAt ?? "9999-12-31T23:59:59.999Z",
      };
    });
  return rankChallengeEntries(entries).map(
    ({ member, flashPoints, durationMs, startedAt, rank }): RoomDailyLeaderboardEntry => ({
      rank,
      memberId: member.id,
      name: member.name,
      initials: member.initials,
      avatarSrc: member.avatarSrc,
      flashPoints,
      completed: true,
      durationMs,
      startedAt,
    }),
  );
}
