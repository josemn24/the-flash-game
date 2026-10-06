import {
  getChallengeDisplayTitle,
  getChallengeFormatLabel,
  getChallengeImage,
  initials,
} from "@/lib/roomPresentation";
import type { GameMode } from "@/types/gameplay/challenge";
import type {
  RoomCardModel,
  RoomCalendarEntry,
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomIntroductionModel,
  RoomLeaderboardEntry,
  RoomMembershipRole,
} from "@/types/view-models";
import { resolveAvatarPath } from "@/infrastructure/supabase/assets/publicAvatar";
import {
  gameModes,
  roomRoles,
  type ChallengeRankingReadRow,
  type RoomCalendarReadRow,
  type RoomIntroductionReadRow,
  type RoomReadRow,
  type SeasonRankingReadRow,
} from "./roomReadContracts";

export function asMode(value: GameMode | null): GameMode | null {
  return value && gameModes.has(value) ? value : null;
}

export function asMemberPreviews(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      (typeof row.avatarPath !== "string" && row.avatarPath !== null)
    ) {
      return [];
    }
    const role = roomRoles.has(row.role as RoomMembershipRole)
      ? (row.role as RoomMembershipRole)
      : undefined;
    return [
      {
        id: row.id,
        name: row.name,
        initials: initials(row.name),
        src: resolveAvatarPath(row.avatarPath),
        role,
      },
    ];
  });
}

export function toLegacySeasonStatus(
  status: RoomReadRow["season_status"],
): RoomDetailModel["seasonStatus"] {
  if (status === "active" || status === "finished") return status;
  return status ? "finished" : null;
}

export function toChallengeSummary(row: RoomReadRow, href: string) {
  const mode = asMode(row.challenge_mode);
  if (
    !row.publication_id ||
    !row.closes_at ||
    !row.challenge_title ||
    row.challenge_subtitle === null ||
    !mode ||
    row.challenge_max_score === null ||
    row.question_count === null
  ) {
    return null;
  }

  return {
    id: row.publication_id,
    title: getChallengeDisplayTitle(row.challenge_title, mode),
    formatLabel: getChallengeFormatLabel(mode),
    subtitle: row.challenge_subtitle,
    availableUntil: row.closes_at,
    questionCount: row.question_count,
    competitivePlayable: row.competitive_playable,
    imageSrc: getChallengeImage(mode),
    href,
  };
}

export function playableChallengeHref(roomSlug: string, publicationId: string) {
  return `/desafios/${publicationId}?roomId=${encodeURIComponent(roomSlug)}`;
}

export function toCard(row: RoomReadRow): RoomCardModel {
  return {
    roomId: row.room_slug,
    title: row.room_title,
    seasonTitle: row.season_title,
    seasonStatus: toLegacySeasonStatus(row.season_status),
    dailyChallenge: toChallengeSummary(
      row,
      playableChallengeHref(row.room_slug, row.publication_id ?? ""),
    ),
    currentUser: {
      totalFlashPoints: row.current_flash_points,
      roomRank: row.current_position,
      role: row.membership_role,
    },
    memberPreviews: asMemberPreviews(row.member_previews),
    memberCount: row.member_count,
    href: `/salas/${row.room_slug}`,
    source: "supabase",
  };
}

export function toSeasonLeaderboard(rows: SeasonRankingReadRow[]): RoomLeaderboardEntry[] {
  return rows.map((row) => ({
    rank: row.position,
    memberId: row.player_id,
    name: row.display_name,
    initials: initials(row.display_name),
    avatarSrc: resolveAvatarPath(row.avatar_path),
    flashPoints: row.flash_points,
  }));
}

export function toChallengeLeaderboard(
  rows: ChallengeRankingReadRow[],
): RoomDailyLeaderboardEntry[] {
  return rows.map((row) => ({
    rank: row.position,
    memberId: row.player_id,
    name: row.display_name,
    initials: initials(row.display_name),
    avatarSrc: resolveAvatarPath(row.avatar_path),
    flashPoints: row.flash_points,
    completed: true,
    durationMs: row.duration_ms,
    // The existing public RPC keeps started_at private; its server-side ordering
    // is authoritative and S06 does not render this field. S07 can expose it via
    // a dedicated historical read contract if the member detail needs it.
    startedAt: "",
  }));
}

export function toDetail(
  row: RoomReadRow,
  viewer: { id: string; name: string; avatarSrc?: string },
  roomLeaderboard: RoomLeaderboardEntry[],
  dailyLeaderboard: RoomDailyLeaderboardEntry[],
  calendar: readonly RoomCalendarEntry[],
) {
  const dailyEntry = dailyLeaderboard.find(({ memberId }) => memberId === viewer.id);
  const currentCalendarEntry = calendar.find(({ id }) => id === row.publication_id);
  const dailyAttemptStatus = toCompetitiveAttemptStatus(currentCalendarEntry?.ownAttemptStatus);
  const dailyChallenge = toChallengeSummary(
    row,
    playableChallengeHref(row.room_slug, row.publication_id ?? ""),
  );

  const detail: RoomDetailModel = {
    roomId: row.room_slug,
    title: row.room_title,
    seasonTitle: row.season_title,
    seasonStatus: toLegacySeasonStatus(row.season_status),
    currentUser: {
      id: viewer.id,
      name: viewer.name,
      initials: initials(viewer.name),
      avatarSrc: viewer.avatarSrc,
      totalFlashPoints: row.current_flash_points,
      roomRank: row.current_position,
      dailyFlashPoints: dailyEntry?.flashPoints ?? 0,
      dailyCompleted: Boolean(dailyEntry),
      dailyAttemptStatus,
      role: row.membership_role,
    },
    dailyChallenge: dailyChallenge
      ? {
          ...dailyChallenge,
          endsAt: dailyChallenge.availableUntil,
        }
      : null,
    roomLeaderboard,
    dailyLeaderboard,
    calendar,
    source: "supabase",
  };
  return detail;
}

function toCompetitiveAttemptStatus(
  status: RoomCalendarEntry["ownAttemptStatus"] | undefined,
): RoomDetailModel["currentUser"]["dailyAttemptStatus"] {
  switch (status) {
    case "in_progress":
      return "inProgress";
    case "completed":
      return "completed";
    case "abandoned":
    case "invalidated":
      return "notCompleted";
    default:
      return "available";
  }
}

export function toIntroduction(row: RoomIntroductionReadRow): RoomIntroductionModel {
  const mode = row.challenge_mode;
  return {
    roomId: row.room_slug,
    roomTitle: row.room_title,
    role: row.membership_role,
    publicationId: row.publication_id,
    publicationStatus: row.publication_status,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    challengeTitle: getChallengeDisplayTitle(row.challenge_title, mode),
    challengeSubtitle: row.challenge_subtitle,
    mode,
    maxScore: row.challenge_max_score,
    questionCount: row.question_count,
    canStart: row.can_start,
    competitivePlayable: row.competitive_playable,
    availabilityStatus: row.availability_status,
    source: "supabase",
  };
}

export function toCalendarEntry(row: RoomCalendarReadRow): RoomCalendarEntry {
  return {
    id: row.publication_id,
    number: row.publication_number,
    timeZone: row.time_zone,
    status: row.publication_status,
    availabilityStatus: row.availability_status,
    ownAttemptStatus: row.own_attempt_status,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    title: getChallengeDisplayTitle(row.challenge_title, row.challenge_mode),
    subtitle: row.challenge_subtitle,
    mode: row.challenge_mode,
    questionCount: row.question_count,
    href: playableChallengeHref(row.room_slug, row.publication_id),
    canStart: row.can_start,
    canContinue: row.can_continue,
  };
}
