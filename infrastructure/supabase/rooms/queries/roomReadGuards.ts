import type { GameMode } from "@/types/gameplay/challenge";
import type { RoomMembershipRole } from "@/types/view-models";
import { isValidTimeZone } from "@/lib/zonedDateTime";
import {
  gameModes,
  roomRoles,
  type ChallengeRankingReadRow,
  type RoomCalendarReadRow,
  type RoomHistoryReadRow,
  type RoomIntroductionReadRow,
  type RoomMemberReviewReadRow,
  type RoomReadRow,
  type SeasonRankingReadRow,
} from "./roomReadContracts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isRoomReadRow(value: unknown): value is RoomReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string" &&
    (row.room_description === null || typeof row.room_description === "string") &&
    typeof row.membership_role === "string" &&
    roomRoles.has(row.membership_role as RoomMembershipRole) &&
    (row.season_id === null || typeof row.season_id === "string") &&
    (row.season_title === null || typeof row.season_title === "string") &&
    (row.season_status === null || typeof row.season_status === "string") &&
    (row.season_starts_at === null || typeof row.season_starts_at === "string") &&
    (row.season_ends_at === null || typeof row.season_ends_at === "string") &&
    (row.publication_id === null || typeof row.publication_id === "string") &&
    (row.publication_status === null || typeof row.publication_status === "string") &&
    (row.opens_at === null || typeof row.opens_at === "string") &&
    (row.closes_at === null || typeof row.closes_at === "string") &&
    (row.challenge_title === null || typeof row.challenge_title === "string") &&
    (row.challenge_subtitle === null || typeof row.challenge_subtitle === "string") &&
    (row.challenge_mode === null || gameModes.has(row.challenge_mode as GameMode)) &&
    (row.challenge_max_score === null || typeof row.challenge_max_score === "number") &&
    (row.question_count === null || typeof row.question_count === "number") &&
    (row.competitive_playable === null || typeof row.competitive_playable === "boolean") &&
    typeof row.current_flash_points === "number" &&
    (row.current_position === null || typeof row.current_position === "number") &&
    (row.member_previews === null || Array.isArray(row.member_previews)) &&
    typeof row.member_count === "number"
  );
}

export function isChallengeRankingReadRow(value: unknown): value is ChallengeRankingReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    (row.avatar_path === null || typeof row.avatar_path === "string") &&
    typeof row.flash_points === "number" &&
    Number.isFinite(row.flash_points) &&
    row.flash_points >= 0 &&
    typeof row.duration_ms === "number" &&
    Number.isFinite(row.duration_ms) &&
    row.duration_ms >= 0 &&
    typeof row.position === "number" &&
    Number.isInteger(row.position) &&
    row.position > 0
  );
}

export function isSeasonRankingReadRow(value: unknown): value is SeasonRankingReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    (row.avatar_path === null || typeof row.avatar_path === "string") &&
    typeof row.flash_points === "number" &&
    Number.isFinite(row.flash_points) &&
    row.flash_points >= 0 &&
    typeof row.is_former_member === "boolean" &&
    typeof row.position === "number" &&
    Number.isInteger(row.position) &&
    row.position > 0
  );
}

export function isRoomIntroductionReadRow(value: unknown): value is RoomIntroductionReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string" &&
    typeof row.membership_role === "string" &&
    roomRoles.has(row.membership_role as RoomMembershipRole) &&
    typeof row.publication_id === "string" &&
    typeof row.publication_status === "string" &&
    typeof row.opens_at === "string" &&
    typeof row.closes_at === "string" &&
    typeof row.challenge_title === "string" &&
    (row.challenge_subtitle === null || typeof row.challenge_subtitle === "string") &&
    typeof row.challenge_mode === "string" &&
    gameModes.has(row.challenge_mode as GameMode) &&
    typeof row.challenge_max_score === "number" &&
    typeof row.question_count === "number" &&
    typeof row.competitive_playable === "boolean" &&
    ["upcoming", "available", "closed", "cancelled"].includes(String(row.availability_status)) &&
    typeof row.can_start === "boolean"
  );
}

export function isRoomCalendarReadRow(value: unknown): value is RoomCalendarReadRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.room_id === "string" &&
    typeof value.room_slug === "string" &&
    typeof value.room_title === "string" &&
    typeof value.time_zone === "string" &&
    isValidTimeZone(value.time_zone) &&
    roomRoles.has(value.membership_role as RoomMembershipRole) &&
    typeof value.season_id === "string" &&
    typeof value.season_title === "string" &&
    (value.season_status === "active" || value.season_status === "finished") &&
    typeof value.publication_id === "string" &&
    typeof value.publication_number === "number" &&
    Number.isInteger(value.publication_number) &&
    value.publication_number > 0 &&
    ["scheduled", "open", "closed", "cancelled"].includes(String(value.publication_status)) &&
    ["upcoming", "available", "closed", "cancelled"].includes(String(value.availability_status)) &&
    typeof value.opens_at === "string" &&
    typeof value.closes_at === "string" &&
    typeof value.challenge_title === "string" &&
    (value.challenge_subtitle === null || typeof value.challenge_subtitle === "string") &&
    typeof value.challenge_mode === "string" &&
    gameModes.has(value.challenge_mode as GameMode) &&
    typeof value.question_count === "number" &&
    Number.isInteger(value.question_count) &&
    value.question_count >= 0 &&
    (value.own_attempt_status === null || typeof value.own_attempt_status === "string") &&
    typeof value.can_start === "boolean" &&
    typeof value.can_continue === "boolean"
  );
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isRoomHistoryReadRow(value: unknown): value is RoomHistoryReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string" &&
    typeof row.viewer_role === "string" &&
    roomRoles.has(row.viewer_role as RoomMembershipRole) &&
    typeof row.season_id === "string" &&
    typeof row.season_title === "string" &&
    typeof row.publication_id === "string" &&
    typeof row.publication_number === "number" &&
    Number.isInteger(row.publication_number) &&
    row.publication_number > 0 &&
    row.publication_status === "closed" &&
    typeof row.publication_opens_at === "string" &&
    typeof row.publication_closes_at === "string" &&
    typeof row.challenge_id === "string" &&
    typeof row.challenge_slug === "string" &&
    typeof row.challenge_version_id === "string" &&
    typeof row.challenge_title === "string" &&
    typeof row.challenge_subtitle === "string" &&
    typeof row.challenge_description === "string" &&
    (row.challenge_mode === "flash" ||
      row.challenge_mode === "survival" ||
      row.challenge_mode === "narrative" ||
      row.challenge_mode === "pyramid") &&
    row.challenge_max_score === 100 &&
    typeof row.question_count === "number" &&
    Number.isInteger(row.question_count) &&
    row.question_count >= 0 &&
    typeof row.question_count === "number" &&
    Number.isInteger(row.question_count) &&
    row.question_count >= 0 &&
    typeof row.played_at === "string" &&
    typeof row.player_count === "number" &&
    Number.isInteger(row.player_count) &&
    row.player_count >= 0 &&
    isNullableString(row.player_id) &&
    isNullableString(row.display_name) &&
    isNullableString(row.avatar_path) &&
    isNullableNumber(row.flash_points) &&
    isNullableNumber(row.duration_ms) &&
    isNullableString(row.started_at) &&
    isNullableNumber(row.position)
  );
}

export function isRoomMemberReviewReadRow(value: unknown): value is RoomMemberReviewReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string" &&
    typeof row.viewer_role === "string" &&
    roomRoles.has(row.viewer_role as RoomMembershipRole) &&
    typeof row.season_id === "string" &&
    typeof row.season_title === "string" &&
    typeof row.publication_id === "string" &&
    (row.publication_status === "open" || row.publication_status === "closed") &&
    typeof row.publication_closes_at === "string" &&
    typeof row.challenge_id === "string" &&
    typeof row.challenge_slug === "string" &&
    typeof row.challenge_version_id === "string" &&
    typeof row.challenge_title === "string" &&
    typeof row.challenge_subtitle === "string" &&
    typeof row.challenge_description === "string" &&
    (row.challenge_mode === "flash" ||
      row.challenge_mode === "survival" ||
      row.challenge_mode === "narrative" ||
      row.challenge_mode === "pyramid") &&
    row.challenge_max_score === 100 &&
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    isNullableString(row.avatar_path) &&
    typeof row.attempt_id === "string" &&
    (row.attempt_status === "completed" || row.attempt_status === "abandoned") &&
    isNullableNumber(row.attempt_score) &&
    isNullableString(row.attempt_outcome) &&
    typeof row.attempt_started_at === "string" &&
    isNullableString(row.attempt_completed_at) &&
    typeof row.attempt_duration_ms === "number" &&
    typeof row.attempt_lock_version === "number" &&
    typeof row.challenge_item_id === "string" &&
    typeof row.item_position === "number" &&
    Number.isInteger(row.item_position) &&
    typeof row.question_version_id === "string" &&
    (row.question_type === "multiple-choice" ||
      row.question_type === "mini-wordle" ||
      row.question_type === "logic-code" ||
      row.question_type === "logic-matrix" ||
      row.question_type === "progressive-clues" ||
      row.question_type === "matching" ||
      row.question_type === "progressive-image" ||
      row.question_type === "queens" ||
      row.question_type === "true-false" ||
      row.question_type === "odd-one-out" ||
      row.question_type === "ordering" ||
      row.question_type === "anagram" ||
      row.question_type === "classification" ||
      row.question_type === "estimation" ||
      row.question_type === "heat-map" ||
      row.question_type === "word-search" ||
      row.question_type === "word-hashtag" ||
      row.question_type === "zip" ||
      row.question_type === "escape") &&
    (row.payload_schema_version === 1 ||
      (row.question_type === "progressive-image" && row.payload_schema_version === 2) ||
      (row.question_type === "estimation" && row.payload_schema_version === 2) ||
      (row.question_type === "heat-map" && row.payload_schema_version === 2)) &&
    (row.time_limit_ms === undefined ||
      (typeof row.time_limit_ms === "number" && row.time_limit_ms > 0)) &&
    (row.public_payload === null || isRecord(row.public_payload)) &&
    (row.solution_payload === null || isRecord(row.solution_payload)) &&
    (row.answer === null ||
      typeof row.answer === "string" ||
      typeof row.answer === "boolean" ||
      Array.isArray(row.answer) ||
      isRecord(row.answer)) &&
    (row.answer_status === null ||
      ["correct", "partial", "incorrect", "unanswered", "timeout"].includes(
        String(row.answer_status),
      )) &&
    isNullableNumber(row.points) &&
    (row.result_details === null || isRecord(row.result_details)) &&
    isNullableString(row.presented_at) &&
    isNullableString(row.submitted_at) &&
    isNullableNumber(row.time_used_ms) &&
    typeof row.item_points === "number" &&
    Number.isFinite(row.item_points) &&
    row.item_points >= 0 &&
    (row.initial_lives === null ||
      (typeof row.initial_lives === "number" && Number.isInteger(row.initial_lives))) &&
    typeof row.has_persisted_answer === "boolean" &&
    isNullableString(row.level_id) &&
    isNullableString(row.level_label) &&
    isNullableString(row.briefing_title) &&
    isNullableString(row.briefing_format) &&
    isNullableString(row.briefing_description)
  );
}
