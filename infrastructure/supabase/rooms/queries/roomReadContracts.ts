import type { AttemptOutcome } from "@/types/domain/attempt";
import type { GameMode } from "@/types/gameplay/challenge";
import type { CompetitiveHistoryMode, RoomMembershipRole } from "@/types/view-models";
import type { PublicFunctionRow } from "@/infrastructure/supabase/rpcTypes";

type RoomReadOverrides = {
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
  current_position: number | null;
};

type RoomReadRpcRow = PublicFunctionRow<"get_my_room_cards"> & PublicFunctionRow<"get_room_detail">;

export type RoomReadRow = Omit<RoomReadRpcRow, keyof RoomReadOverrides> & RoomReadOverrides;

type RoomIntroductionOverrides = {
  membership_role: RoomMembershipRole;
  publication_status: "scheduled" | "open" | "closed" | "cancelled";
  challenge_subtitle: string | null;
  challenge_mode: GameMode;
  availability_status: "upcoming" | "available" | "closed" | "cancelled";
};

type RoomIntroductionRpcRow = PublicFunctionRow<"get_room_introduction">;

export type RoomIntroductionReadRow = Omit<
  RoomIntroductionRpcRow,
  keyof RoomIntroductionOverrides
> &
  RoomIntroductionOverrides;

type RoomCalendarOverrides = {
  membership_role: RoomMembershipRole;
  season_status: "active" | "finished";
  publication_status: "scheduled" | "open" | "closed" | "cancelled";
  availability_status: "upcoming" | "available" | "closed" | "cancelled";
  challenge_subtitle: string | null;
  challenge_mode: GameMode;
  own_attempt_status: "in_progress" | "completed" | "abandoned" | "invalidated" | null;
};

type RoomCalendarRpcRow = PublicFunctionRow<"get_room_calendar">;

export type RoomCalendarReadRow = Omit<RoomCalendarRpcRow, keyof RoomCalendarOverrides> &
  RoomCalendarOverrides;

type ChallengeRankingOverrides = {
  avatar_path: string | null;
};

type ChallengeRankingRpcRow = PublicFunctionRow<"get_challenge_ranking">;

export type ChallengeRankingReadRow = Omit<
  ChallengeRankingRpcRow,
  keyof ChallengeRankingOverrides
> &
  ChallengeRankingOverrides;

type SeasonRankingOverrides = {
  avatar_path: string | null;
};

type SeasonRankingRpcRow = PublicFunctionRow<"get_season_ranking">;

export type SeasonRankingReadRow = Omit<SeasonRankingRpcRow, keyof SeasonRankingOverrides> &
  SeasonRankingOverrides;

type RoomHistoryOverrides = {
  viewer_role: RoomMembershipRole;
  publication_status: "closed";
  challenge_mode: CompetitiveHistoryMode;
  player_id: string | null;
  display_name: string | null;
  avatar_path: string | null;
  flash_points: number | null;
  duration_ms: number | null;
  started_at: string | null;
  position: number | null;
};

type RoomHistoryRpcRow = PublicFunctionRow<"get_room_history">;

export type RoomHistoryReadRow = Omit<RoomHistoryRpcRow, keyof RoomHistoryOverrides> &
  RoomHistoryOverrides;

type RoomMemberReviewOverrides = {
  viewer_role: RoomMembershipRole;
  publication_status: "open" | "closed";
  challenge_mode: CompetitiveHistoryMode;
  initial_lives: number | null;
  global_time_limit_ms: number | null;
  alphabet_letter: string | null;
  avatar_path: string | null;
  attempt_status: "completed" | "abandoned";
  attempt_score: number | null;
  attempt_outcome: AttemptOutcome;
  attempt_completed_at: string | null;
  question_type:
    | "multiple-choice"
    | "short-text"
    | "mini-wordle"
    | "logic-code"
    | "logic-matrix"
    | "progressive-clues"
    | "matching"
    | "connect-pairs"
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

type RoomMemberReviewRpcRow = PublicFunctionRow<"get_room_member_review">;

export type RoomMemberReviewReadRow = Omit<
  RoomMemberReviewRpcRow,
  keyof RoomMemberReviewOverrides
> &
  RoomMemberReviewOverrides;

export const roomRoles = new Set<RoomMembershipRole>(["owner", "admin", "member", "spectator"]);
export const gameModes = new Set<GameMode>([
  "flash",
  "alphabet",
  "survival",
  "narrative",
  "pyramid",
]);
