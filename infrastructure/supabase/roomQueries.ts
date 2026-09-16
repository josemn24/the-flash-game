import "server-only";

import type {
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
} from "@/application/queries";
import {
  getChallengeDisplayTitle,
  getChallengeFormatLabel,
  getChallengeImage,
} from "@/application/presentation/room";
import { createClient } from "@/lib/supabase/server";
import type { GameMode } from "@/types/gameplay/challenge";
import type {
  AnswerReview,
  Challenge,
  MultipleChoicePromptVisual,
  Question,
  QuestionMedia,
} from "@/types/game";
import { assertSupportedQuestionPayloadSchemaVersion } from "@/types/contracts";
import { isValidTimeZone } from "@/lib/zonedDateTime";
import type {
  RoomCardModel,
  RoomCalendarEntry,
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomHistoryDetailModel,
  RoomHistoryEntry,
  RoomHistoryListModel,
  RoomIntroductionModel,
  RoomLeaderboardEntry,
  RoomMemberDetailModel,
  RoomMembershipRole,
  RoomRankingModel,
} from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";

type RoomReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  room_description: string | null;
  membership_role: RoomMembershipRole;
  season_id: string | null;
  season_title: string | null;
  season_status: "draft" | "scheduled" | "active" | "finished" | "cancelled" | null;
  season_starts_at: string | null;
  season_ends_at: string | null;
  publication_id: string | null;
  publication_status: "scheduled" | "open" | "closed" | "cancelled" | null;
  opens_at: string | null;
  closes_at: string | null;
  challenge_title: string | null;
  challenge_subtitle: string | null;
  challenge_mode: GameMode | null;
  challenge_max_score: number | null;
  question_count: number | null;
  competitive_playable: boolean;
  current_flash_points: number;
  current_position: number | null;
  member_previews: unknown;
  member_count: number;
};

type RoomIntroductionReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  membership_role: RoomMembershipRole;
  publication_id: string;
  publication_status: "scheduled" | "open" | "closed" | "cancelled";
  opens_at: string;
  closes_at: string;
  challenge_title: string;
  challenge_subtitle: string | null;
  challenge_mode: GameMode;
  challenge_max_score: number;
  question_count: number;
  competitive_playable: boolean;
  availability_status: "upcoming" | "available" | "closed" | "cancelled";
  can_start: boolean;
};

type RoomCalendarReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  time_zone: string;
  membership_role: RoomMembershipRole;
  season_id: string;
  season_title: string;
  season_status: "active" | "finished";
  publication_id: string;
  publication_number: number;
  publication_status: "scheduled" | "open" | "closed" | "cancelled";
  availability_status: "upcoming" | "available" | "closed" | "cancelled";
  opens_at: string;
  closes_at: string;
  challenge_title: string;
  challenge_subtitle: string | null;
  challenge_mode: GameMode;
  question_count: number;
  own_attempt_status: "in_progress" | "completed" | "abandoned" | "invalidated" | null;
  can_start: boolean;
  can_continue: boolean;
};

type ChallengeRankingReadRow = {
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  flash_points: number;
  duration_ms: number;
  position: number;
};

type SeasonRankingReadRow = {
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  flash_points: number;
  is_former_member: boolean;
  position: number;
};

type FlashHistoryReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  viewer_role: RoomMembershipRole;
  season_id: string;
  season_title: string;
  publication_id: string;
  publication_number: number;
  publication_status: "closed";
  publication_opens_at: string;
  publication_closes_at: string;
  challenge_id: string;
  challenge_slug: string;
  challenge_version_id: string;
  challenge_title: string;
  challenge_subtitle: string;
  challenge_description: string;
  challenge_mode: "flash";
  challenge_max_score: number;
  question_count: number;
  played_at: string;
  player_count: number;
  player_id: string | null;
  display_name: string | null;
  avatar_path: string | null;
  flash_points: number | null;
  duration_ms: number | null;
  started_at: string | null;
  position: number | null;
};

type FlashMemberReviewReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  viewer_role: RoomMembershipRole;
  publication_id: string;
  publication_status: "open" | "closed";
  publication_closes_at: string;
  challenge_id: string;
  challenge_slug: string;
  challenge_version_id: string;
  challenge_title: string;
  challenge_subtitle: string;
  challenge_description: string;
  challenge_mode: "flash";
  challenge_max_score: number;
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  attempt_id: string;
  attempt_status: "completed" | "abandoned";
  attempt_score: number | null;
  attempt_started_at: string;
  attempt_completed_at: string;
  attempt_lock_version: number;
  challenge_item_id: string;
  item_position: number;
  question_version_id: string;
  question_type: "multiple-choice";
  payload_schema_version: number;
  public_payload: unknown;
  solution_payload: unknown;
  answer: unknown;
  answer_status: "correct" | "partial" | "incorrect" | "unanswered" | "timeout" | null;
  points: number | null;
  result_details: unknown;
  presented_at: string | null;
  submitted_at: string | null;
  time_used_ms: number | null;
  item_points: number;
};

const roomRoles = new Set<RoomMembershipRole>(["owner", "admin", "member", "spectator"]);
const gameModes = new Set<GameMode>(["flash", "alphabet", "survival", "narrative", "pyramid"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRoomReadRow(value: unknown): value is RoomReadRow {
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
    typeof row.competitive_playable === "boolean" &&
    typeof row.current_flash_points === "number" &&
    (row.current_position === null || typeof row.current_position === "number") &&
    Array.isArray(row.member_previews) &&
    typeof row.member_count === "number"
  );
}

function isChallengeRankingReadRow(value: unknown): value is ChallengeRankingReadRow {
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

function isSeasonRankingReadRow(value: unknown): value is SeasonRankingReadRow {
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

function isRoomIntroductionReadRow(value: unknown): value is RoomIntroductionReadRow {
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

function isRoomCalendarReadRow(value: unknown): value is RoomCalendarReadRow {
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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isFlashHistoryReadRow(value: unknown): value is FlashHistoryReadRow {
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
    row.challenge_mode === "flash" &&
    row.challenge_max_score === 100 &&
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

function isFlashMemberReviewReadRow(value: unknown): value is FlashMemberReviewReadRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.room_id === "string" &&
    typeof row.room_slug === "string" &&
    typeof row.room_title === "string" &&
    typeof row.viewer_role === "string" &&
    roomRoles.has(row.viewer_role as RoomMembershipRole) &&
    typeof row.publication_id === "string" &&
    (row.publication_status === "open" || row.publication_status === "closed") &&
    typeof row.publication_closes_at === "string" &&
    typeof row.challenge_id === "string" &&
    typeof row.challenge_slug === "string" &&
    typeof row.challenge_version_id === "string" &&
    typeof row.challenge_title === "string" &&
    typeof row.challenge_subtitle === "string" &&
    typeof row.challenge_description === "string" &&
    row.challenge_mode === "flash" &&
    row.challenge_max_score === 100 &&
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    isNullableString(row.avatar_path) &&
    typeof row.attempt_id === "string" &&
    (row.attempt_status === "completed" || row.attempt_status === "abandoned") &&
    isNullableNumber(row.attempt_score) &&
    typeof row.attempt_started_at === "string" &&
    typeof row.attempt_completed_at === "string" &&
    typeof row.attempt_lock_version === "number" &&
    typeof row.challenge_item_id === "string" &&
    typeof row.item_position === "number" &&
    Number.isInteger(row.item_position) &&
    typeof row.question_version_id === "string" &&
    row.question_type === "multiple-choice" &&
    row.payload_schema_version === 1 &&
    isRecord(row.public_payload) &&
    isRecord(row.solution_payload) &&
    (row.answer === null || typeof row.answer === "string") &&
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
    row.item_points >= 0
  );
}

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return (parts.length > 1 ? parts.map((part) => part[0]).join("") : displayName.slice(0, 2))
    .toUpperCase()
    .slice(0, 2);
}

function asMode(value: GameMode | null): GameMode | null {
  return value && gameModes.has(value) ? value : null;
}

function asMemberPreviews(value: unknown) {
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
    return [
      {
        id: row.id,
        name: row.name,
        initials: initials(row.name),
        src: row.avatarPath ?? undefined,
      },
    ];
  });
}

function toLegacySeasonStatus(
  status: RoomReadRow["season_status"],
): RoomDetailModel["seasonStatus"] {
  if (status === "active" || status === "finished") return status;
  return status ? "finished" : null;
}

function toChallengeSummary(row: RoomReadRow, href: string) {
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

function playableChallengeHref(roomSlug: string, publicationId: string) {
  return `/desafios/${publicationId}?roomId=${encodeURIComponent(roomSlug)}`;
}

function toCard(row: RoomReadRow): RoomCardModel {
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

function toSeasonLeaderboard(rows: SeasonRankingReadRow[]): RoomLeaderboardEntry[] {
  return rows.map((row) => ({
    rank: row.position,
    memberId: row.player_id,
    name: row.display_name,
    initials: initials(row.display_name),
    avatarSrc: row.avatar_path ?? undefined,
    flashPoints: row.flash_points,
  }));
}

function toChallengeLeaderboard(rows: ChallengeRankingReadRow[]): RoomDailyLeaderboardEntry[] {
  return rows.map((row) => ({
    rank: row.position,
    memberId: row.player_id,
    name: row.display_name,
    initials: initials(row.display_name),
    avatarSrc: row.avatar_path ?? undefined,
    flashPoints: row.flash_points,
    completed: true,
    durationMs: row.duration_ms,
    // The existing public RPC keeps started_at private; its server-side ordering
    // is authoritative and S06 does not render this field. S07 can expose it via
    // a dedicated historical read contract if the member detail needs it.
    startedAt: "",
  }));
}

function toDetail(
  row: RoomReadRow,
  viewer: { id: string; name: string; avatarSrc?: string },
  roomLeaderboard: RoomLeaderboardEntry[],
  dailyLeaderboard: RoomDailyLeaderboardEntry[],
  calendar: readonly RoomCalendarEntry[],
) {
  const dailyEntry = dailyLeaderboard.find(({ memberId }) => memberId === viewer.id);
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
      dailyAttemptStatus: "available",
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

function toIntroduction(row: RoomIntroductionReadRow): RoomIntroductionModel {
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

function toCalendarEntry(row: RoomCalendarReadRow): RoomCalendarEntry {
  return {
    id: row.publication_id,
    number: row.publication_number,
    timeZone: row.time_zone,
    status: row.publication_status,
    availabilityStatus: row.availability_status,
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

async function callRoomRead(
  functionName: "get_my_room_cards" | "get_room_detail" | "get_room_introduction" | "get_room_calendar",
  args: Record<string, string> = {},
  guard: (value: unknown) => boolean = isRoomReadRow,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase room read failed (${functionName}): ${error.message}`);
  if (!Array.isArray(data)) return [];
  if (functionName === "get_room_calendar") {
    return data.map((value, index) => {
      if (!guard(value)) {
        throw new Error(`Supabase room read returned an invalid row (${functionName}, ${index})`);
      }
      return value;
    });
  }
  return data.filter(guard);
}

async function callRankingRead<T>(
  functionName: "get_challenge_ranking" | "get_season_ranking",
  args: Record<string, string>,
  guard: (value: unknown) => value is T,
): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase ranking read failed (${functionName}): ${error.message}`);
  if (!Array.isArray(data)) {
    throw new Error(`Supabase ranking read returned an invalid payload (${functionName})`);
  }
  return data.map((value, index) => {
    if (!guard(value)) {
      throw new Error(`Supabase ranking read returned an invalid row (${functionName}, ${index})`);
    }
    return value;
  });
}

async function callHistoryRead<T>(
  functionName: "get_flash_history" | "get_flash_member_review",
  args: Record<string, string | null>,
  guard: (value: unknown) => value is T,
): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase history read failed (${functionName}): ${error.message}`);
  if (!Array.isArray(data)) {
    throw new Error(`Supabase history read returned an invalid payload (${functionName})`);
  }
  return data.map((value, index) => {
    if (!guard(value)) {
      throw new Error(`Supabase history read returned an invalid row (${functionName}, ${index})`);
    }
    return value;
  });
}

function toHistoryEntry(row: FlashHistoryReadRow): RoomHistoryEntry {
  return {
    id: row.publication_id,
    challengeId: row.publication_id,
    title: getChallengeDisplayTitle(row.challenge_title, "flash"),
    playedAt: row.played_at,
    imageSrc: getChallengeImage("flash"),
    playerCount: row.player_count,
  };
}

function toHistoricalLeaderboard(rows: FlashHistoryReadRow[]): RoomDailyLeaderboardEntry[] {
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
            avatarSrc: row.avatar_path ?? undefined,
            flashPoints: row.flash_points,
            completed: true,
            durationMs: row.duration_ms,
            startedAt: row.started_at,
          },
        ]
      : [],
  );
}

function historicalChallengeSummary(row: FlashHistoryReadRow) {
  return {
    id: row.publication_id,
    title: getChallengeDisplayTitle(row.challenge_title, "flash"),
    formatLabel: getChallengeFormatLabel("flash"),
    subtitle: row.challenge_subtitle,
    imageSrc: getChallengeImage("flash"),
    questionCount: row.question_count,
    playedAt: row.played_at,
  };
}

function currentMemberChallengeSummary(row: RoomReadRow) {
  const summary = toChallengeSummary(
    row,
    playableChallengeHref(row.room_slug, row.publication_id ?? ""),
  );
  return summary
    ? {
        id: summary.id,
        title: summary.title,
        formatLabel: summary.formatLabel,
        subtitle: summary.subtitle,
        imageSrc: summary.imageSrc,
        questionCount: summary.questionCount,
        playedAt: summary.availableUntil,
      }
    : null;
}

function requiredRecordField(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (!isRecord(value)) throw new Error(`Invalid ${label}.${key} payload`);
  return value;
}

function requiredStringField(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`Invalid ${label}.${key} payload`);
  return value;
}

function toHistoricalFlashQuestion(row: FlashMemberReviewReadRow): Question {
  assertSupportedQuestionPayloadSchemaVersion(row.payload_schema_version);
  const publicPayload = row.public_payload as Record<string, unknown>;
  const solutionPayload = row.solution_payload as Record<string, unknown>;
  const tags = requiredRecordField(publicPayload, "tags", "public_payload");
  const payload = requiredRecordField(publicPayload, "payload", "public_payload");
  const solution = requiredRecordField(solutionPayload, "solution", "solution_payload");
  const solutionData = requiredRecordField(solution, "payload", "solution_payload.solution");
  const options = payload.options;
  const domains = tags.domains;
  const topics = tags.topics;
  const cognitiveSkills = tags.cognitiveSkills;
  const formatSkills = tags.formatSkills;
  const lifeSkills = tags.lifeSkills ?? [];
  if (
    !Array.isArray(options) ||
    !options.every((value) => typeof value === "string") ||
    !Array.isArray(domains) ||
    !domains.every((value) => typeof value === "string") ||
    !Array.isArray(topics) ||
    !topics.every((value) => typeof value === "string") ||
    !Array.isArray(cognitiveSkills) ||
    !cognitiveSkills.every((value) => typeof value === "string") ||
    !Array.isArray(formatSkills) ||
    !formatSkills.every((value) => typeof value === "string") ||
    !Array.isArray(lifeSkills) ||
    !lifeSkills.every((value) => typeof value === "string")
  ) {
    throw new Error(`Invalid historical Flash payload (${row.challenge_item_id})`);
  }
  const correctAnswer = solutionData.correctAnswer;
  const explanation = solution.explanation;
  if (typeof correctAnswer !== "string" || typeof explanation !== "string") {
    throw new Error(`Invalid historical Flash solution (${row.challenge_item_id})`);
  }
  const prompt = requiredStringField(publicPayload, "prompt", "public_payload");
  const category = requiredStringField(publicPayload, "category", "public_payload");
  const context = publicPayload.context;
  const timeLimitMs = publicPayload.timeLimitMs;
  if (
    (context !== null && typeof context !== "string") ||
    typeof timeLimitMs !== "number" ||
    !Number.isFinite(timeLimitMs)
  ) {
    throw new Error(`Invalid historical Flash timing (${row.challenge_item_id})`);
  }
  return {
    id: row.challenge_item_id,
    category,
    tags: { domains, topics, cognitiveSkills, formatSkills, lifeSkills },
    question: prompt,
    ...(context ? { questionContext: context } : {}),
    timeLimit: timeLimitMs / 1_000,
    points: row.item_points,
    explanation,
    type: "multiple-choice",
    options,
    correctAnswer,
    ...(payload.media ? { media: payload.media as QuestionMedia } : {}),
    ...(payload.promptVisual
      ? { promptVisual: payload.promptVisual as MultipleChoicePromptVisual }
      : {}),
  } as Question;
}

function toHistoricalChallenge(rows: FlashMemberReviewReadRow[]): Challenge {
  const first = rows[0];
  if (!first) throw new Error("Cannot build a historical Flash without rows");
  const questions = rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map(toHistoricalFlashQuestion);
  return {
    id: first.publication_id,
    definitionId: first.challenge_slug,
    number: 1,
    title: first.challenge_title,
    subtitle: first.challenge_subtitle,
    description: first.challenge_description,
    mode: "flash",
    questions,
    questionPoints: Object.fromEntries(
      rows.map((row) => [row.challenge_item_id, row.item_points]),
    ),
  };
}

function toHistoricalResult(rows: FlashMemberReviewReadRow[]) {
  const first = rows[0];
  if (!first) return null;
  const answers: AnswerReview[] = rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map((row) => {
      const status =
        row.answer_status === "timeout" || row.answer_status === null
          ? "unanswered"
          : row.answer_status;
      return {
        questionId: row.challenge_item_id,
        answer: row.answer as AnswerReview["answer"],
        status,
        isCorrect: status === "correct" || status === "partial",
        points: row.points ?? 0,
        timeUsed: (row.time_used_ms ?? 0) / 1_000,
        ...(row.result_details
          ? { details: row.result_details as AnswerReview["details"] }
          : {}),
      };
    });
  const durationMs = rows.reduce((total, row) => total + (row.time_used_ms ?? 0), 0);
  const completed = first.attempt_status === "completed";
  return {
    flashPoints: first.attempt_score ?? 0,
    completed,
    attempt: {
      challengeId: first.publication_id,
      startedAt: first.attempt_started_at,
      playedAt: first.attempt_completed_at,
      durationMs,
      flashPoints: first.attempt_score ?? 0,
      completed,
      answers,
    },
  };
}

function toHistoricalMember(
  rows: FlashMemberReviewReadRow[],
  fallback: { id: string; name: string; avatarSrc?: string },
): RoomMemberDetailModel["member"] {
  const first = rows[0];
  const name = first?.display_name ?? fallback.name;
  const avatarSrc = first?.avatar_path ?? fallback.avatarSrc;
  return {
    id: first?.player_id ?? fallback.id,
    name,
    initials: initials(name),
    avatarSrc: avatarSrc ?? undefined,
    totalFlashPoints: 0,
    challengeResults: {},
  };
}

export class SupabaseRoomQueries
  implements RoomHistoryQueries, RoomLobbyQueries, RoomMemberDetailQueries, RoomRankingQueries
{
  async listCards() {
    return (await callRoomRead("get_my_room_cards")).map(toCard);
  }

  async getDetail(roomKey: string) {
    const viewer = await getCurrentViewerProfile();
    if (!viewer) return null;
    const rows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
    const row = rows[0];
    if (!row) return null;

    const [seasonRows, dailyRows, calendarRows] = await Promise.all([
      row.season_id
        ? callRankingRead(
            "get_season_ranking",
            { target_season_id: row.season_id },
            isSeasonRankingReadRow,
          )
        : Promise.resolve([]),
      row.publication_id && row.publication_status === "open"
        ? callRankingRead(
            "get_challenge_ranking",
            { target_publication_id: row.publication_id },
            isChallengeRankingReadRow,
          )
        : Promise.resolve([]),
      callRoomRead(
        "get_room_calendar",
        { target_room_slug: roomKey },
        isRoomCalendarReadRow,
      ),
    ]);

    return toDetail(
      row,
      viewer,
      toSeasonLeaderboard(seasonRows),
      toChallengeLeaderboard(dailyRows),
      calendarRows.map((value) => toCalendarEntry(value as RoomCalendarReadRow)),
    );
  }

  async getIntroduction(roomKey: string, challengeKey: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(challengeKey)) return null;
    const rows = await callRoomRead(
      "get_room_introduction",
      {
        target_room_slug: roomKey,
        target_publication_id: challengeKey,
      },
      isRoomIntroductionReadRow,
    );
    return rows[0] ? toIntroduction(rows[0]) : null;
  }

  async getRanking(roomKey: string): Promise<RoomRankingModel | null> {
    const viewer = await getCurrentViewerProfile();
    if (!viewer) return null;

    const rows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
    const row = rows[0];
    if (!row || !row.season_id) return null;

    const rankingRows = await callRankingRead(
      "get_season_ranking",
      { target_season_id: row.season_id },
      isSeasonRankingReadRow,
    );
    return {
      roomId: row.room_slug,
      roomTitle: row.room_title,
      currentUserId: viewer.playerId,
      entries: toSeasonLeaderboard(rankingRows),
    };
  }

  async listHistory(roomKey: string): Promise<RoomHistoryListModel | null> {
    const rows = await callHistoryRead(
      "get_flash_history",
      { target_room_slug: roomKey },
      isFlashHistoryReadRow,
    );
    const first = rows[0];
    if (!first) {
      const viewer = await getCurrentViewerProfile();
      if (!viewer) return null;
      // The RPC intentionally returns no rows for an unknown or inaccessible room.
      // Resolve the room separately only to distinguish an accessible empty history.
      const roomRows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
      const room = roomRows[0];
      if (!room) return null;
      return {
        roomId: room.room_slug,
        roomTitle: room.room_title,
        entries: [],
        rankings: {},
        source: "supabase",
      };
    }

    const byPublication = new Map<string, FlashHistoryReadRow[]>();
    for (const row of rows) {
      const group = byPublication.get(row.publication_id) ?? [];
      group.push(row);
      byPublication.set(row.publication_id, group);
    }
    const entries = [...byPublication.values()].map(([row]) => toHistoryEntry(row));
    const rankings = Object.fromEntries(
      [...byPublication.entries()].map(([publicationId, publicationRows]) => [
        publicationId,
        toHistoricalLeaderboard(publicationRows),
      ]),
    );
    return {
      roomId: first.room_slug,
      roomTitle: first.room_title,
      entries,
      rankings,
      source: "supabase",
    };
  }

  async getHistoryDetail(
    roomKey: string,
    publicationKey: string,
  ): Promise<RoomHistoryDetailModel | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(publicationKey)) return null;
    const rows = await callHistoryRead(
      "get_flash_history",
      { target_room_slug: roomKey, target_publication_id: publicationKey },
      isFlashHistoryReadRow,
    );
    const first = rows[0];
    if (!first) return null;
    return {
      roomId: first.room_slug,
      roomTitle: first.room_title,
      currentUserId: (await getCurrentViewerProfile())?.playerId ?? "",
      entry: toHistoryEntry(first),
      ranking: toHistoricalLeaderboard(rows),
      canReviewMembers: first.viewer_role !== "spectator",
      source: "supabase",
    };
  }

  async getMemberDetail(
    roomKey: string,
    memberKey: string,
    publicationKey?: string,
  ): Promise<RoomMemberDetailModel | null> {
    const viewer = await getCurrentViewerProfile();
    if (!viewer || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(memberKey)) return null;

    let historyRow: FlashHistoryReadRow | undefined;
    let currentRoomRow: RoomReadRow | undefined;
    let challengeLeaderboard: RoomDailyLeaderboardEntry[] = [];
    let challengeSummary: RoomMemberDetailModel["challengeSummary"] = null;
    let resolvedPublicationId: string | undefined = publicationKey;
    let seasonId: string | undefined;

    if (publicationKey) {
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(publicationKey)) return null;
      const rows = await callHistoryRead(
        "get_flash_history",
        { target_room_slug: roomKey, target_publication_id: publicationKey },
        isFlashHistoryReadRow,
      );
      historyRow = rows[0];
      if (!historyRow) return null;
      seasonId = historyRow.season_id;
      challengeSummary = historicalChallengeSummary(historyRow);
      challengeLeaderboard = toHistoricalLeaderboard(rows);
    } else {
      const roomRows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
      currentRoomRow = roomRows[0];
      if (!currentRoomRow?.publication_id || !currentRoomRow.season_id) return null;
      resolvedPublicationId = currentRoomRow.publication_id;
      seasonId = currentRoomRow.season_id;
      challengeSummary = currentMemberChallengeSummary(currentRoomRow);
      if (!challengeSummary || currentRoomRow.publication_status !== "open") return null;
    }

    if (!resolvedPublicationId || !seasonId) return null;
    const [reviewRows, seasonRows, rankingRows] = await Promise.all([
      callHistoryRead(
        "get_flash_member_review",
        {
          target_room_slug: roomKey,
          target_publication_id: resolvedPublicationId,
          target_player_id: memberKey,
        },
        isFlashMemberReviewReadRow,
      ),
      callRankingRead(
        "get_season_ranking",
        { target_season_id: seasonId },
        isSeasonRankingReadRow,
      ),
      historyRow
        ? Promise.resolve(challengeLeaderboard)
        : callRankingRead(
            "get_challenge_ranking",
            { target_publication_id: resolvedPublicationId },
            isChallengeRankingReadRow,
          ).then(toChallengeLeaderboard),
    ]);
    if (!historyRow) challengeLeaderboard = rankingRows;

    const seasonEntry = seasonRows.find((entry) => entry.player_id === memberKey);
    const reviewMember = reviewRows[0];
    if (!reviewMember && !seasonEntry) return null;
    const member = toHistoricalMember(reviewRows, {
      id: memberKey,
      name: seasonEntry?.display_name ?? viewer.name,
      avatarSrc: seasonEntry?.avatar_path ?? viewer.avatarSrc,
    });
    member.totalFlashPoints = seasonEntry?.flash_points ?? 0;
    const roomLeaderboard = toSeasonLeaderboard(seasonRows);
    const challenge = reviewRows.length ? toHistoricalChallenge(reviewRows) : null;
    const result = reviewRows.length ? toHistoricalResult(reviewRows) : null;
    const viewerRole = reviewMember?.viewer_role ?? currentRoomRow?.membership_role;
    return {
      roomId: roomKey,
      roomTitle: reviewMember?.room_title ?? historyRow?.room_title ?? currentRoomRow?.room_title ?? "",
      member,
      challengeSummary,
      challenge,
      result,
      roomRank: seasonEntry?.position ?? 0,
      challengeRank: challengeLeaderboard.find(({ memberId }) => memberId === memberKey)?.rank ?? null,
      roomLeaderboard,
      challengeLeaderboard,
      returnHref: historyRow
        ? `/salas/${roomKey}/historial/${resolvedPublicationId}`
        : `/salas/${roomKey}/ranking`,
      source: "supabase",
      canReviewMembers: viewerRole !== "spectator",
    };
  }
}

export const supabaseRoomQueries = new SupabaseRoomQueries();
