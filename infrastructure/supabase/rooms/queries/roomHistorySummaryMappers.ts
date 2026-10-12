import { resolveAvatarPath } from "@/infrastructure/supabase/assets/publicAvatar";
import {
  getChallengeDisplayTitle,
  getChallengeFormatLabel,
  getChallengeImage,
  initials,
} from "@/lib/roomPresentation";
import type { RoomDailyLeaderboardEntry, RoomHistoryEntry } from "@/types/view-models";
import type { RoomHistoryReadRow, RoomReadRow } from "./roomReadContracts";
import { asMode, playableChallengeHref, toChallengeSummary } from "./roomViewMappers";

export function toHistoryEntry(row: RoomHistoryReadRow): RoomHistoryEntry {
  return {
    id: row.publication_id,
    challengeId: row.publication_id,
    mode: row.challenge_mode,
    title: getChallengeDisplayTitle(row.challenge_title, row.challenge_mode),
    formatLabel: getChallengeFormatLabel(row.challenge_mode),
    subtitle: row.challenge_subtitle,
    questionCount: row.question_count,
    maxScore: row.challenge_max_score,
    playedAt: row.played_at,
    imageSrc: getChallengeImage(row.challenge_mode),
    playerCount: row.player_count,
  };
}

export function toHistoricalLeaderboard(rows: RoomHistoryReadRow[]): RoomDailyLeaderboardEntry[] {
  return rows.flatMap((row) =>
    row.player_id &&
    row.display_name &&
    row.flash_points !== null &&
    row.duration_ms !== null &&
    row.started_at &&
    row.position !== null
      ? [
          {
            rank: row.position,
            memberId: row.player_id,
            name: row.display_name,
            initials: initials(row.display_name),
            avatarSrc: resolveAvatarPath(row.avatar_path),
            flashPoints: row.flash_points,
            completed: true,
            durationMs: row.duration_ms,
            startedAt: row.started_at,
          },
        ]
      : [],
  );
}

export function historicalChallengeSummary(row: RoomHistoryReadRow) {
  return {
    id: row.publication_id,
    mode: row.challenge_mode,
    title: getChallengeDisplayTitle(row.challenge_title, row.challenge_mode),
    formatLabel: getChallengeFormatLabel(row.challenge_mode),
    subtitle: row.challenge_subtitle,
    imageSrc: getChallengeImage(row.challenge_mode),
    questionCount: row.question_count,
    playedAt: row.played_at,
  };
}

export function currentMemberChallengeSummary(row: RoomReadRow) {
  const summary = toChallengeSummary(
    row,
    playableChallengeHref(row.room_slug, row.publication_id ?? ""),
  );
  return summary
    ? {
        id: summary.id,
        mode: asMode(row.challenge_mode) ?? "flash",
        title: summary.title,
        formatLabel: summary.formatLabel,
        subtitle: summary.subtitle,
        imageSrc: summary.imageSrc,
        questionCount: summary.questionCount,
        playedAt: summary.availableUntil,
      }
    : null;
}
