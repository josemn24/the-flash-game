import type { GameMode } from "@/types/gameplay/challenge";
import type { CompetitiveHistoryMode, RoomMembershipRole } from "@/types/view-models";

export type RoomReadRow = {
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
  competitive_playable: boolean | null;
  current_flash_points: number;
  current_position: number | null;
  member_previews: unknown;
  member_count: number;
};

export type RoomIntroductionReadRow = {
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

export type RoomCalendarReadRow = {
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

export type ChallengeRankingReadRow = {
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  flash_points: number;
  duration_ms: number;
  position: number;
};

export type SeasonRankingReadRow = {
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  flash_points: number;
  is_former_member: boolean;
  position: number;
};

export type RoomHistoryReadRow = {
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
  challenge_mode: CompetitiveHistoryMode;
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

export type RoomMemberReviewReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  viewer_role: RoomMembershipRole;
  season_id: string;
  season_title: string;
  publication_id: string;
  publication_status: "open" | "closed";
  publication_closes_at: string;
  challenge_id: string;
  challenge_slug: string;
  challenge_version_id: string;
  challenge_title: string;
  challenge_subtitle: string;
  challenge_description: string;
  challenge_mode: CompetitiveHistoryMode;
  challenge_max_score: number;
  question_count: number;
  initial_lives: number | null;
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  attempt_id: string;
  attempt_status: "completed" | "abandoned";
  attempt_score: number | null;
  attempt_outcome: string | null;
  attempt_started_at: string;
  attempt_completed_at: string | null;
  attempt_duration_ms: number;
  attempt_lock_version: number;
  challenge_item_id: string;
  item_position: number;
  question_version_id: string;
  question_type:
    | "multiple-choice"
    | "mini-wordle"
    | "logic-code"
    | "logic-matrix"
    | "progressive-clues"
    | "matching"
    | "progressive-image"
    | "queens"
    | "true-false"
    | "odd-one-out"
    | "ordering"
    | "anagram"
    | "classification"
    | "estimation"
    | "heat-map"
    | "word-search"
    | "word-hashtag"
    | "zip"
    | "escape";
  payload_schema_version: number;
  time_limit_ms?: number;
  public_payload: unknown | null;
  solution_payload: unknown | null;
  answer: unknown;
  answer_status: "correct" | "partial" | "incorrect" | "unanswered" | "timeout" | null;
  points: number | null;
  result_details: unknown;
  presented_at: string | null;
  submitted_at: string | null;
  time_used_ms: number | null;
  item_points: number;
  has_persisted_answer: boolean;
  level_id: string | null;
  level_label: string | null;
  briefing_title: string | null;
  briefing_format: string | null;
  briefing_description: string | null;
};

export const roomRoles = new Set<RoomMembershipRole>(["owner", "admin", "member", "spectator"]);
export const gameModes = new Set<GameMode>([
  "flash",
  "alphabet",
  "survival",
  "narrative",
  "pyramid",
]);
