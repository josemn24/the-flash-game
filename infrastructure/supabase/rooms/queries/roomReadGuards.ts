import { isValidAttemptLifecycle } from "@/lib/attemptLifecycle";
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

type ReadRow = Record<string, unknown>;
type ReviewQuestionType = RoomMemberReviewReadRow["question_type"];

const publicationStatuses = ["scheduled", "open", "closed", "cancelled"];
const availabilityStatuses = ["upcoming", "available", "closed", "cancelled"];
const answerStatuses = ["correct", "partial", "incorrect", "unanswered", "timeout"];
const reviewQuestionTypes = new Set<ReviewQuestionType>([
  "multiple-choice",
  "short-text",
  "mini-wordle",
  "logic-code",
  "logic-matrix",
  "progressive-clues",
  "matching",
  "progressive-image",
  "queens",
  "true-false",
  "odd-one-out",
  "ordering",
  "anagram",
  "classification",
  "estimation",
  "heat-map",
  "word-search",
  "word-hashtag",
  "zip",
  "escape",
]);
const questionTypesWithSchemaV2 = new Set<ReviewQuestionType>([
  "progressive-image",
  "estimation",
  "heat-map",
]);

export function isRecord(value: unknown): value is ReadRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isRoomReadRow(value: unknown): value is RoomReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadRow;
  return (
    hasRoomIdentity(row) &&
    isNullableString(row.room_description) &&
    isRoomRole(row.membership_role) &&
    hasNullableSeasonFields(row) &&
    hasNullablePublicationFields(row) &&
    hasNullableChallengeFields(row) &&
    hasRoomMemberSummary(row)
  );
}

export function isChallengeRankingReadRow(value: unknown): value is ChallengeRankingReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadRow;
  return (
    hasPlayerIdentity(row) && hasRankingResult(row) && isNonNegativeFiniteNumber(row.duration_ms)
  );
}

export function isSeasonRankingReadRow(value: unknown): value is SeasonRankingReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadRow;
  return (
    hasPlayerIdentity(row) && hasRankingResult(row) && typeof row.is_former_member === "boolean"
  );
}

export function isRoomIntroductionReadRow(value: unknown): value is RoomIntroductionReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadRow;
  return (
    hasRoomIdentity(row) &&
    isRoomRole(row.membership_role) &&
    hasIntroductionPublicationFields(row) &&
    hasIntroductionChallengeFields(row) &&
    availabilityStatuses.includes(String(row.availability_status)) &&
    typeof row.can_start === "boolean"
  );
}

export function isRoomCalendarReadRow(value: unknown): value is RoomCalendarReadRow {
  if (!isRecord(value)) return false;
  return (
    hasRoomIdentity(value) &&
    typeof value.time_zone === "string" &&
    isValidTimeZone(value.time_zone) &&
    isRoomRole(value.membership_role) &&
    hasCalendarSeasonFields(value) &&
    hasCalendarPublicationFields(value) &&
    hasCalendarChallengeFields(value) &&
    hasCalendarAttemptFields(value)
  );
}

export function isRoomHistoryReadRow(value: unknown): value is RoomHistoryReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadRow;
  return (
    hasRoomSeasonContext(row) &&
    hasHistoryPublicationFields(row) &&
    hasReviewChallengeFields(row) &&
    isNonNegativeInteger(row.question_count) &&
    hasHistoryParticipationFields(row)
  );
}

export function isRoomMemberReviewReadRow(value: unknown): value is RoomMemberReviewReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadRow;
  return (
    hasRoomSeasonContext(row) &&
    hasMemberReviewPublicationFields(row) &&
    hasReviewChallengeFields(row) &&
    hasPlayerIdentity(row) &&
    hasReviewAttemptFields(row) &&
    hasReviewQuestionFields(row) &&
    hasReviewAnswerFields(row) &&
    hasReviewModeConfiguration(row) &&
    hasReviewLevelFields(row)
  );
}

// Shared identities and scalar checks.
function isRoomRole(value: unknown): value is RoomMembershipRole {
  return typeof value === "string" && roomRoles.has(value as RoomMembershipRole);
}

function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && gameModes.has(value as GameMode);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasRoomIdentity(row: ReadRow) {
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string"
  );
}

function hasSeasonIdentity(row: ReadRow) {
  return typeof row.season_id === "string" && typeof row.season_title === "string";
}

function hasPlayerIdentity(row: ReadRow) {
  return (
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    isNullableString(row.avatar_path)
  );
}

function hasRankingResult(row: ReadRow) {
  return isNonNegativeFiniteNumber(row.flash_points) && isPositiveInteger(row.position);
}

function hasChallengeSummary(row: ReadRow) {
  return (
    typeof row.challenge_title === "string" &&
    isNullableString(row.challenge_subtitle) &&
    isGameMode(row.challenge_mode)
  );
}

// Room cards and details allow missing seasons, publications and challenges.
function hasNullableSeasonFields(row: ReadRow) {
  return (
    isNullableString(row.season_id) &&
    isNullableString(row.season_title) &&
    isNullableString(row.season_status) &&
    isNullableString(row.season_starts_at) &&
    isNullableString(row.season_ends_at)
  );
}

function hasNullablePublicationFields(row: ReadRow) {
  return (
    isNullableString(row.publication_id) &&
    isNullableString(row.publication_status) &&
    isNullableString(row.opens_at) &&
    isNullableString(row.closes_at)
  );
}

function hasNullableChallengeFields(row: ReadRow) {
  return (
    isNullableString(row.challenge_title) &&
    isNullableString(row.challenge_subtitle) &&
    (row.challenge_mode === null || isGameMode(row.challenge_mode)) &&
    (row.challenge_max_score === null || typeof row.challenge_max_score === "number") &&
    (row.question_count === null || typeof row.question_count === "number") &&
    (row.competitive_playable === null || typeof row.competitive_playable === "boolean")
  );
}

function hasRoomMemberSummary(row: ReadRow) {
  return (
    typeof row.current_flash_points === "number" &&
    (row.current_position === null || typeof row.current_position === "number") &&
    (row.member_previews === null || Array.isArray(row.member_previews)) &&
    typeof row.member_count === "number"
  );
}

// Introduction and calendar rows have different publication and count rules.
function hasIntroductionPublicationFields(row: ReadRow) {
  return (
    typeof row.publication_id === "string" &&
    typeof row.publication_status === "string" &&
    typeof row.opens_at === "string" &&
    typeof row.closes_at === "string"
  );
}

function hasIntroductionChallengeFields(row: ReadRow) {
  return (
    hasChallengeSummary(row) &&
    typeof row.challenge_max_score === "number" &&
    typeof row.question_count === "number" &&
    typeof row.competitive_playable === "boolean"
  );
}

function hasCalendarSeasonFields(row: ReadRow) {
  return (
    hasSeasonIdentity(row) && (row.season_status === "active" || row.season_status === "finished")
  );
}

function hasCalendarPublicationFields(row: ReadRow) {
  return (
    typeof row.publication_id === "string" &&
    isPositiveInteger(row.publication_number) &&
    publicationStatuses.includes(String(row.publication_status)) &&
    availabilityStatuses.includes(String(row.availability_status)) &&
    typeof row.opens_at === "string" &&
    typeof row.closes_at === "string"
  );
}

function hasCalendarChallengeFields(row: ReadRow) {
  return hasChallengeSummary(row) && isNonNegativeInteger(row.question_count);
}

function hasCalendarAttemptFields(row: ReadRow) {
  return (
    isNullableString(row.own_attempt_status) &&
    typeof row.can_start === "boolean" &&
    typeof row.can_continue === "boolean"
  );
}

// History and member reviews share the room, season and challenge context.
function hasRoomSeasonContext(row: ReadRow) {
  return hasRoomIdentity(row) && isRoomRole(row.viewer_role) && hasSeasonIdentity(row);
}

function hasHistoryPublicationFields(row: ReadRow) {
  return (
    typeof row.publication_id === "string" &&
    isPositiveInteger(row.publication_number) &&
    row.publication_status === "closed" &&
    typeof row.publication_opens_at === "string" &&
    typeof row.publication_closes_at === "string"
  );
}

function hasMemberReviewPublicationFields(row: ReadRow) {
  return (
    typeof row.publication_id === "string" &&
    (row.publication_status === "open" || row.publication_status === "closed") &&
    typeof row.publication_closes_at === "string"
  );
}

function hasReviewChallengeFields(row: ReadRow) {
  return (
    typeof row.challenge_id === "string" &&
    typeof row.challenge_slug === "string" &&
    typeof row.challenge_version_id === "string" &&
    typeof row.challenge_title === "string" &&
    typeof row.challenge_subtitle === "string" &&
    typeof row.challenge_description === "string" &&
    isGameMode(row.challenge_mode) &&
    row.challenge_max_score === 100
  );
}

function hasHistoryParticipationFields(row: ReadRow) {
  return (
    typeof row.played_at === "string" &&
    isNonNegativeInteger(row.player_count) &&
    isNullableString(row.player_id) &&
    isNullableString(row.display_name) &&
    isNullableString(row.avatar_path) &&
    isNullableNumber(row.flash_points) &&
    isNullableNumber(row.duration_ms) &&
    isNullableString(row.started_at) &&
    isNullableNumber(row.position)
  );
}

function hasReviewAttemptFields(row: ReadRow) {
  return (
    typeof row.attempt_id === "string" &&
    (row.attempt_status === "completed" || row.attempt_status === "abandoned") &&
    isNullableNumber(row.attempt_score) &&
    isValidAttemptLifecycle({
      challengeMode: row.challenge_mode,
      status: row.attempt_status,
      outcome: row.attempt_outcome,
    }) &&
    typeof row.attempt_started_at === "string" &&
    isNullableString(row.attempt_completed_at) &&
    typeof row.attempt_duration_ms === "number" &&
    typeof row.attempt_lock_version === "number"
  );
}

function hasSupportedPayloadSchema(row: ReadRow) {
  return (
    row.payload_schema_version === 1 ||
    (row.payload_schema_version === 2 &&
      questionTypesWithSchemaV2.has(row.question_type as ReviewQuestionType))
  );
}

function hasReviewQuestionFields(row: ReadRow) {
  return (
    typeof row.challenge_item_id === "string" &&
    isInteger(row.item_position) &&
    typeof row.question_version_id === "string" &&
    reviewQuestionTypes.has(row.question_type as ReviewQuestionType) &&
    hasSupportedPayloadSchema(row) &&
    (row.time_limit_ms === undefined ||
      (typeof row.time_limit_ms === "number" && row.time_limit_ms > 0)) &&
    (row.public_payload === null || isRecord(row.public_payload)) &&
    (row.solution_payload === null || isRecord(row.solution_payload)) &&
    isNonNegativeFiniteNumber(row.item_points)
  );
}

function isReviewAnswer(value: unknown) {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    Array.isArray(value) ||
    isRecord(value)
  );
}

function hasReviewAnswerFields(row: ReadRow) {
  return (
    isReviewAnswer(row.answer) &&
    (row.answer_status === null || answerStatuses.includes(String(row.answer_status))) &&
    isNullableNumber(row.points) &&
    (row.result_details === null || isRecord(row.result_details)) &&
    isNullableString(row.presented_at) &&
    isNullableString(row.submitted_at) &&
    isNullableNumber(row.time_used_ms) &&
    typeof row.has_persisted_answer === "boolean"
  );
}

function hasReviewModeConfiguration(row: ReadRow) {
  if (row.initial_lives !== null && !isInteger(row.initial_lives)) return false;

  if (row.challenge_mode !== "alphabet") {
    return row.global_time_limit_ms === null && row.alphabet_letter === null;
  }

  return (
    row.question_type === "short-text" &&
    typeof row.global_time_limit_ms === "number" &&
    Number.isSafeInteger(row.global_time_limit_ms) &&
    row.global_time_limit_ms > 0 &&
    typeof row.alphabet_letter === "string" &&
    /^[A-ZÑ]$/u.test(row.alphabet_letter) &&
    typeof row.time_limit_ms === "number" &&
    isRecord(row.public_payload) &&
    isRecord(row.solution_payload)
  );
}

function hasReviewLevelFields(row: ReadRow) {
  return (
    isNullableString(row.level_id) &&
    isNullableString(row.level_label) &&
    isNullableString(row.briefing_title) &&
    isNullableString(row.briefing_format) &&
    isNullableString(row.briefing_description)
  );
}
