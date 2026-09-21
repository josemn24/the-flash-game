import type { RoomQueries } from "@/application/queries";
import { getCompetitiveAttemptStatus } from "@/features/rooms/competitiveAttempt";
import { projectLegacyAttempt } from "@/data/mock/legacyAdapters";
import {
  getPlayerRouteKey,
  getRoomRouteKey,
  getScheduledChallengeRouteKey,
  resolvePlayerRouteKey,
  resolveRoomRouteKey,
  selectChallengeRanking,
  selectOpenScheduledChallenge,
  selectRoomHistory,
  selectSeasonRanking,
} from "@/data/mock/selectors";
import { legacyChallenges } from "@/data/mock/legacyChallengeAdapter";
import { getMockMembershipOverride } from "@/infrastructure/mock/roomMembershipCommands";
import {
  getChallengeDisplayTitle,
  getChallengeFormatLabel,
  getChallengeImage,
} from "@/application/presentation/room";
import type {
  DomainStore,
  Player,
  PlayerId,
  RoomId,
  ScheduledChallenge,
  Season,
} from "@/types/domain";
import type {
  QueryContext,
  RoomCardModel,
  RoomDailyLeaderboardEntry,
  RoomLeaderboardEntry,
  RoomMemberViewModel,
} from "@/types/view-models";

const historyImages: Readonly<Record<string, string>> = {
  "tabarnia-flash-01": "/flash-pop/concepts/room-ready.webp",
  "tabarnia-challenge-02": "/flash-pop/concepts/alphabet-orbit.webp",
  "tabarnia-challenge-03": "/flash-pop/concepts/survival-last-beacon.webp",
  "tabarnia-challenge-04": "/flash-pop/concepts/narrative-story-trail.webp",
  "tabarnia-challenge-05": "/flash-pop/concepts/pyramid-soft-diorama.webp",
};

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return (parts.length > 1 ? parts.map((part) => part[0]).join("") : displayName.slice(0, 2))
    .toUpperCase()
    .slice(0, 2);
}

function rankByFlashPoints<Entry extends { flashPoints: number }>(entries: Entry[]) {
  const ordered = [...entries].sort((left, right) => right.flashPoints - left.flashPoints);
  return ordered.map((entry) => ({
    ...entry,
    rank: ordered.findIndex((candidate) => candidate.flashPoints === entry.flashPoints) + 1,
  }));
}

export class MockRoomQueries implements RoomQueries {
  constructor(private readonly store: DomainStore) {}

  private roomAccess(roomKey: string, viewerId: PlayerId) {
    const roomId = resolveRoomRouteKey(roomKey);
    const room = roomId ? this.store.rooms.find(({ id }) => id === roomId) : undefined;
    const membership = room ? this.effectiveMembership(room.id, viewerId) : undefined;
    return room && membership ? { room, membership } : null;
  }

  private effectiveMembership(roomId: RoomId, playerId: PlayerId) {
    const membership = this.store.roomMemberships.find(
      (candidate) => candidate.roomId === roomId && candidate.playerId === playerId,
    );
    if (!membership) return undefined;
    const override = getMockMembershipOverride(roomId, playerId);
    if (!override) return membership.status === "active" ? membership : undefined;
    return override.status === "active" ? { ...membership, ...override } : undefined;
  }

  private activeSeason(roomId: RoomId) {
    return (
      this.store.seasons.find((season) => season.roomId === roomId && season.status === "active") ??
      null
    );
  }

  private player(playerId: PlayerId) {
    const player = this.store.players.find(({ id }) => id === playerId);
    const routeKey = getPlayerRouteKey(playerId);
    if (!player || !routeKey) throw new Error(`Missing player projection for "${playerId}".`);
    return { player, routeKey };
  }

  private activePlayers(roomId: RoomId) {
    return this.store.roomMemberships
      .filter((membership) => this.effectiveMembership(roomId, membership.playerId))
      .map((membership) => ({
        membership: this.effectiveMembership(roomId, membership.playerId)!,
        ...this.player(membership.playerId),
      }));
  }

  private seasonLeaderboard(roomId: RoomId, season: Season): RoomLeaderboardEntry[] {
    const flashPointsByPlayer = new Map(
      selectSeasonRanking(season.id, this.store).map(({ playerId, flashPoints }) => [
        playerId,
        flashPoints,
      ]),
    );
    const playerIds = new Set<PlayerId>([
      ...this.activePlayers(roomId)
        .filter(({ membership }) => membership.role !== "spectator")
        .map(({ player }) => player.id),
      ...flashPointsByPlayer.keys(),
    ]);
    return rankByFlashPoints(
      [...playerIds].map((playerId) => {
        const { player, routeKey } = this.player(playerId);
        return {
          memberId: routeKey,
          name: player.displayName,
          initials: initials(player.displayName),
          avatarSrc: player.avatarPath ?? undefined,
          flashPoints: flashPointsByPlayer.get(playerId) ?? 0,
        };
      }),
    );
  }

  private challengeVersion(schedule: ScheduledChallenge) {
    const version = this.store.challengeVersions.find(
      ({ id }) => id === schedule.challengeVersionId,
    );
    if (!version) throw new Error(`Missing challenge version for "${schedule.id}".`);
    return version;
  }

  private dailyChallenge(schedule: ScheduledChallenge | null) {
    if (!schedule) return null;
    const version = this.challengeVersion(schedule);
    const routeKey = getScheduledChallengeRouteKey(schedule.id);
    if (!routeKey) throw new Error(`Missing scheduled challenge alias for "${schedule.id}".`);
    const questionCount = this.store.challengeItems.filter(
      ({ challengeVersionId }) => challengeVersionId === version.id,
    ).length;
    return { schedule, version, routeKey, questionCount };
  }

  private bestAttempt(playerId: PlayerId, scheduledChallengeId: ScheduledChallenge["id"]) {
    return this.store.attempts
      .filter(
        (attempt) =>
          attempt.playerId === playerId &&
          attempt.scheduledChallengeId === scheduledChallengeId &&
          attempt.kind === "competitive" &&
          attempt.status === "completed" &&
          attempt.score !== null,
      )
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
  }

  private dailyLeaderboard(schedule: ScheduledChallenge): RoomDailyLeaderboardEntry[] {
    const season = this.store.seasons.find(({ id }) => id === schedule.seasonId);
    if (!season) throw new Error(`Missing season for "${schedule.id}".`);
    return selectChallengeRanking(schedule.id, this.store).map((entry) => {
      const { player, routeKey } = this.player(entry.playerId);
      return {
        rank: entry.rank,
        memberId: routeKey,
        name: player.displayName,
        initials: initials(player.displayName),
        avatarSrc: player.avatarPath ?? undefined,
        flashPoints: entry.flashPoints,
        completed: true,
        durationMs: entry.durationMs,
        startedAt: entry.startedAt,
      };
    });
  }

  private memberModel(player: Player, roomId: RoomId, season: Season): RoomMemberViewModel {
    const routeKey = getPlayerRouteKey(player.id);
    if (!routeKey) throw new Error(`Missing route alias for player "${player.id}".`);
    const totalFlashPoints =
      selectSeasonRanking(season.id, this.store).find(({ playerId }) => playerId === player.id)
        ?.flashPoints ?? 0;
    const schedules = this.store.scheduledChallenges.filter(
      ({ seasonId }) => seasonId === season.id,
    );
    return {
      id: routeKey,
      name: player.displayName,
      initials: initials(player.displayName),
      avatarSrc: player.avatarPath ?? undefined,
      totalFlashPoints,
      challengeResults: Object.fromEntries(
        schedules.map((schedule) => {
          const challengeKey = getScheduledChallengeRouteKey(schedule.id);
          if (!challengeKey) throw new Error(`Missing route alias for schedule "${schedule.id}".`);
          const attempt = this.bestAttempt(player.id, schedule.id);
          return [
            challengeKey,
            {
              flashPoints: attempt?.score ?? 0,
              completed: Boolean(attempt),
              attempt: attempt ? projectLegacyAttempt(attempt.id, this.store) : undefined,
            },
          ];
        }),
      ),
    };
  }

  private roomCard(roomId: RoomId, context: QueryContext): RoomCardModel | null {
    const room = this.store.rooms.find(({ id }) => id === roomId);
    const roomKey = room ? getRoomRouteKey(room.id) : null;
    const season = room ? this.activeSeason(room.id) : null;
    if (!room || !roomKey || !season) return null;
    const leaderboard = this.seasonLeaderboard(room.id, season);
    const viewerKey = getPlayerRouteKey(context.viewerId);
    const viewer = leaderboard.find(({ memberId }) => memberId === viewerKey);
    if (!viewerKey) throw new Error(`Missing route alias for viewer "${context.viewerId}".`);
    const daily = this.dailyChallenge(
      selectOpenScheduledChallenge(season.id, new Date(context.now), this.store),
    );
    const members = this.activePlayers(room.id);
    return {
      roomId: roomKey,
      title: room.title,
      seasonTitle: season.title,
      seasonStatus: season.status === "active" ? "active" : "finished",
      dailyChallenge: daily
        ? {
            id: daily.routeKey,
            title: getChallengeDisplayTitle(daily.version.title, daily.version.mode),
            formatLabel: getChallengeFormatLabel(daily.version.mode),
            subtitle: daily.version.subtitle,
            availableUntil: daily.schedule.closesAt,
            questionCount: daily.questionCount,
            imageSrc: getChallengeImage(daily.version.mode),
          }
        : null,
      currentUser: {
        totalFlashPoints: viewer?.flashPoints ?? 0,
        roomRank: viewer?.rank ?? 0,
      },
      memberPreviews: members.slice(0, 4).map(({ player, routeKey }) => ({
        id: routeKey,
        name: player.displayName,
        initials: initials(player.displayName),
        src: player.avatarPath ?? undefined,
      })),
      memberCount: members.length,
      href: `/salas/${roomKey}`,
    };
  }

  async listCards(context: QueryContext) {
    const roomIds = this.store.roomMemberships
      .filter(
        (membership) => membership.playerId === context.viewerId && membership.status === "active",
      )
      .map(({ roomId }) => roomId);
    return roomIds.flatMap((roomId) => {
      const card = this.roomCard(roomId, context);
      return card ? [card] : [];
    });
  }

  async getDetail(roomKey: string, context: QueryContext) {
    const access = this.roomAccess(roomKey, context.viewerId);
    const season = access ? this.activeSeason(access.room.id) : null;
    if (!access || !season) return null;
    const current = this.player(context.viewerId);
    const roomLeaderboard = this.seasonLeaderboard(access.room.id, season);
    const roomEntry = roomLeaderboard.find(({ memberId }) => memberId === current.routeKey);
    const daily = this.dailyChallenge(
      selectOpenScheduledChallenge(season.id, new Date(context.now), this.store),
    );
    const dailyLeaderboard = daily ? this.dailyLeaderboard(daily.schedule) : [];
    const dailyEntry = dailyLeaderboard.find(({ memberId }) => memberId === current.routeKey);
    const dailyAttemptStatus = daily
      ? getCompetitiveAttemptStatus(
          this.store.attempts.filter(
            (attempt) =>
              attempt.playerId === context.viewerId &&
              attempt.scheduledChallengeId === daily.schedule.id &&
              attempt.kind === "competitive",
          ),
        )
      : "available";
    return {
      roomId: roomKey,
      title: access.room.title,
      seasonTitle: season.title,
      seasonStatus: "active" as const,
      currentUser: {
        id: current.routeKey,
        name: current.player.displayName,
        initials: initials(current.player.displayName),
        avatarSrc: current.player.avatarPath ?? undefined,
        totalFlashPoints: roomEntry?.flashPoints ?? 0,
        roomRank: roomEntry?.rank ?? 0,
        dailyFlashPoints: dailyEntry?.flashPoints ?? 0,
        dailyCompleted: dailyEntry?.completed ?? false,
        dailyAttemptStatus,
      },
      dailyChallenge: daily
        ? {
            id: daily.routeKey,
            title: getChallengeDisplayTitle(daily.version.title, daily.version.mode),
            formatLabel: getChallengeFormatLabel(daily.version.mode),
            subtitle: daily.version.subtitle,
            imageSrc: getChallengeImage(daily.version.mode),
            questionCount: daily.questionCount,
            endsAt: daily.schedule.closesAt,
            href: `/desafios/${daily.routeKey}?roomId=${encodeURIComponent(roomKey)}`,
          }
        : null,
      roomLeaderboard,
      dailyLeaderboard,
      calendar: [],
    };
  }

  async getSettings(roomKey: string, context: QueryContext) {
    const access = this.roomAccess(roomKey, context.viewerId);
    const season = access ? this.activeSeason(access.room.id) : null;
    if (!access || !season) return null;
    const flashPoints = new Map(
      this.seasonLeaderboard(access.room.id, season).map(({ memberId, flashPoints }) => [
        memberId,
        flashPoints,
      ]),
    );
    const currentKey = getPlayerRouteKey(context.viewerId);
    if (!currentKey) throw new Error(`Missing route alias for viewer "${context.viewerId}".`);
    const members = this.activePlayers(access.room.id).map(({ player, routeKey }) => ({
      id: routeKey,
      name: player.displayName,
      initials: initials(player.displayName),
      avatarSrc: player.avatarPath ?? undefined,
      totalFlashPoints: flashPoints.get(routeKey) ?? 0,
      isCurrentUser: routeKey === currentKey,
    }));
    return {
      roomId: roomKey,
      title: access.room.title,
      currentUserId: currentKey,
      viewerRole: access.membership.role,
      canManageMembers: access.membership.role === "owner",
      memberCount: members.length,
      members: members.map((member) => {
        const membership = this.effectiveMembership(
          access.room.id,
          resolvePlayerRouteKey(member.id)!,
        );
        const role = membership?.role ?? "member";
        return {
          ...member,
          role,
          canManage:
            access.membership.role === "owner" &&
            member.id !== currentKey &&
            role !== "owner",
        };
      }),
    };
  }

  async getRanking(roomKey: string, context: QueryContext) {
    const access = this.roomAccess(roomKey, context.viewerId);
    const season = access ? this.activeSeason(access.room.id) : null;
    const currentUserId = getPlayerRouteKey(context.viewerId);
    if (!access || !season || !currentUserId) return null;
    return {
      roomId: roomKey,
      roomTitle: access.room.title,
      currentUserId,
      entries: this.seasonLeaderboard(access.room.id, season),
    };
  }

  async getMemberDetail(roomKey: string, memberKey: string, context: QueryContext) {
    const access = this.roomAccess(roomKey, context.viewerId);
    const season = access ? this.activeSeason(access.room.id) : null;
    const memberId = resolvePlayerRouteKey(memberKey);
    const memberMembership =
      access && memberId
        ? this.store.roomMemberships.find(
            (candidate) => candidate.roomId === access.room.id && candidate.playerId === memberId,
          )
        : undefined;
    const player = memberId ? this.store.players.find(({ id }) => id === memberId) : undefined;
    if (!access || !season || !memberMembership || !player) return null;
    const detail = await this.getDetail(roomKey, context);
    if (!detail) return null;
    const member = this.memberModel(player, access.room.id, season);
    const dailyKey = detail.dailyChallenge?.id;
    const result = dailyKey ? (member.challengeResults[dailyKey] ?? null) : null;
    const challenge = dailyKey
      ? (legacyChallenges.find((candidate) => candidate.id === dailyKey) ?? null)
      : null;
    return {
      roomId: roomKey,
      roomTitle: access.room.title,
      member,
      challengeSummary: detail.dailyChallenge
        ? {
            id: detail.dailyChallenge.id,
            title: detail.dailyChallenge.title,
            formatLabel: detail.dailyChallenge.formatLabel,
            subtitle: detail.dailyChallenge.subtitle,
            imageSrc: detail.dailyChallenge.imageSrc,
            questionCount: detail.dailyChallenge.questionCount,
            playedAt: detail.dailyChallenge.endsAt,
          }
        : null,
      challenge,
      result,
      roomRank: detail.roomLeaderboard.find(({ memberId: id }) => id === memberKey)?.rank ?? 0,
      challengeRank:
        detail.dailyLeaderboard.find(({ memberId: id }) => id === memberKey)?.rank ?? null,
      roomLeaderboard: detail.roomLeaderboard,
      challengeLeaderboard: detail.dailyLeaderboard,
      returnHref: `/salas/${roomKey}/ranking`,
      canReviewMembers: access.membership.role !== "spectator",
    };
  }

  private historyRanking(scheduleId: ScheduledChallenge["id"]) {
    const schedule = this.store.scheduledChallenges.find(({ id }) => id === scheduleId);
    if (!schedule) throw new Error(`Missing scheduled challenge "${scheduleId}".`);
    return this.dailyLeaderboard(schedule);
  }

  async listHistory(roomKey: string, context: QueryContext) {
    const access = this.roomAccess(roomKey, context.viewerId);
    if (!access) return null;
    const history = selectRoomHistory(access.room.id, this.store);
    const entries = history.map(({ scheduledChallenge, playedAt, participantCount }) => {
      const challengeKey = getScheduledChallengeRouteKey(scheduledChallenge.id);
      if (!challengeKey)
        throw new Error(`Missing route alias for schedule "${scheduledChallenge.id}".`);
      const version = this.challengeVersion(scheduledChallenge);
      return {
        id: `tabarnia-history-${String(scheduledChallenge.number).padStart(2, "0")}`,
        challengeId: challengeKey,
        title: version.title,
        playedAt,
        imageSrc: historyImages[challengeKey] ?? getChallengeImage(version.mode),
        playerCount: participantCount,
      };
    });
    return {
      roomId: roomKey,
      roomTitle: access.room.title,
      entries,
      rankings: Object.fromEntries(
        history.map(({ scheduledChallenge }) => {
          const key = getScheduledChallengeRouteKey(scheduledChallenge.id)!;
          return [key, this.historyRanking(scheduledChallenge.id)];
        }),
      ),
    };
  }

  async getHistoryDetail(roomKey: string, challengeKey: string, context: QueryContext) {
    const history = await this.listHistory(roomKey, context);
    const access = this.roomAccess(roomKey, context.viewerId);
    const currentUserId = getPlayerRouteKey(context.viewerId);
    const entry = history?.entries.find((candidate) => candidate.challengeId === challengeKey);
    if (!history || !access || !currentUserId || !entry) return null;
    return {
      roomId: roomKey,
      roomTitle: access.room.title,
      currentUserId,
      entry,
      ranking: history.rankings[challengeKey] ?? [],
      canReviewMembers: access.membership.role !== "spectator",
    };
  }
}
