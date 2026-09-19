import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AnswerResult, RoomChallengeResult } from "@/types/game";
import type {
  ServerAlphabetChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";

type AlphabetReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  publication_id: string;
  publication_status: "scheduled" | "open" | "closed" | "cancelled";
  publication_opens_at: string;
  publication_closes_at: string;
  challenge_slug: string;
  challenge_title: string;
  challenge_subtitle: string;
  challenge_description: string;
  challenge_max_score: number;
  global_time_limit_ms: number;
  question_count: number;
  own_attempt_id: string | null;
  own_attempt_status: "in_progress" | "completed" | "abandoned" | "invalidated" | null;
  own_attempt_score: number | null;
  own_attempt_started_at: string | null;
  own_attempt_completed_at: string | null;
  own_attempt_deadline_at: string | null;
  own_attempt_lock_version: number | null;
  challenge_item_id: string;
  item_position: number;
  question_version_id: string;
  question_type: "short-text";
  payload_schema_version: number;
  time_limit_ms: number;
  item_points: number;
  alphabet_letter: string;
};

type AlphabetResultRow = {
  attempt_id: string;
  scheduled_challenge_id: string;
  challenge_item_id: string;
  item_position: number;
  question_version_id: string;
  question_type: "short-text";
  payload_schema_version: number;
  public_payload: unknown;
  solution_payload: unknown;
  answer: unknown;
  answer_status: AnswerResult["status"] | null;
  points: number;
  result_details: AnswerResult["details"] | null;
  presented_at: string | null;
  submitted_at: string | null;
  time_used_ms: number;
  attempt_status: "completed";
  attempt_score: number;
  attempt_started_at: string;
  attempt_completed_at: string;
  attempt_lock_version: number;
  challenge_title: string;
  challenge_subtitle: string;
  challenge_description: string;
  challenge_max_score: number;
  alphabet_letter: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAlphabetReadRow(value: unknown): value is AlphabetReadRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.room_id === "string" &&
    typeof value.room_slug === "string" &&
    typeof value.room_title === "string" &&
    typeof value.publication_id === "string" &&
    typeof value.challenge_slug === "string" &&
    typeof value.challenge_title === "string" &&
    typeof value.challenge_subtitle === "string" &&
    typeof value.challenge_description === "string" &&
    value.challenge_max_score === 100 &&
    Number.isSafeInteger(value.global_time_limit_ms) &&
    Number(value.global_time_limit_ms) > 0 &&
    Number.isSafeInteger(value.question_count) &&
    Number(value.question_count) >= 2 &&
    Number(value.question_count) <= 20 &&
    typeof value.challenge_item_id === "string" &&
    Number.isSafeInteger(value.item_position) &&
    typeof value.question_version_id === "string" &&
    value.question_type === "short-text" &&
    value.payload_schema_version === 1 &&
    Number.isSafeInteger(value.time_limit_ms) &&
    Number(value.time_limit_ms) > 0 &&
    Number.isSafeInteger(value.item_points) &&
    Number(value.item_points) > 0 &&
    Number(value.item_points) <= 100 &&
    typeof value.alphabet_letter === "string" &&
    Array.from(value.alphabet_letter).length === 1
  );
}

function isAlphabetResultRow(value: unknown): value is AlphabetResultRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.attempt_id === "string" &&
    typeof value.scheduled_challenge_id === "string" &&
    typeof value.challenge_item_id === "string" &&
    value.question_type === "short-text" &&
    value.payload_schema_version === 1 &&
    isRecord(value.public_payload) &&
    isRecord(value.solution_payload) &&
    (typeof value.answer === "string" || value.answer === null) &&
    (value.answer_status === null ||
      ["correct", "partial", "incorrect", "unanswered", "timeout"].includes(
        String(value.answer_status),
      )) &&
    typeof value.points === "number" &&
    typeof value.time_used_ms === "number" &&
    value.attempt_status === "completed" &&
    typeof value.alphabet_letter === "string"
  );
}

function toRoomContext(row: AlphabetReadRow, viewerId: string, result?: RoomChallengeResult): GameRoomContext {
  return {
    roomId: row.room_slug,
    roomTitle: row.room_title,
    returnTo: `/salas/${row.room_slug}`,
    memberId: viewerId,
    availabilityStatus: "available",
    attemptStatus:
      row.own_attempt_status === "completed"
        ? "completed"
        : row.own_attempt_status === "in_progress"
          ? "inProgress"
          : row.own_attempt_status === "abandoned" || row.own_attempt_status === "invalidated"
            ? "notCompleted"
            : "available",
    gameplayPersistence: "server",
    ...(result ? { result } : {}),
  };
}

async function callAlphabetRead(functionName: "get_my_alphabet_challenge" | "get_my_alphabet_result", args: Record<string, string>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase alphabet read failed (${functionName}): ${error.message}`);
  return Array.isArray(data) ? data : [];
}

function toResult(rows: AlphabetResultRow[]): RoomChallengeResult {
  const first = rows[0]!;
  const answers: AnswerResult[] = rows.map((row) => ({
    questionId: row.challenge_item_id,
    answer: row.answer as AnswerResult["answer"],
    status: row.answer_status ?? "unanswered",
    isCorrect: row.answer_status === "correct" || row.answer_status === "partial",
    points: row.points,
    timeUsed: row.time_used_ms / 1000,
    ...(row.result_details ? { details: row.result_details } : {}),
  }));
  return {
    flashPoints: first.attempt_score,
    completed: first.attempt_status === "completed",
    attempt: {
      challengeId: first.scheduled_challenge_id,
      startedAt: first.attempt_started_at,
      playedAt: first.attempt_completed_at,
      flashPoints: first.attempt_score,
      completed: first.attempt_status === "completed",
      durationMs: rows.reduce((sum, row) => sum + row.time_used_ms, 0),
      answers,
    },
  };
}

export class SupabaseAlphabetQueries {
  async getPlayable(roomKey: string, publicationId: string) {
    const viewer = await getCurrentViewerProfile();
    if (!viewer) return null;
    const rows = (await callAlphabetRead("get_my_alphabet_challenge", {
      target_room_slug: roomKey,
      target_publication_id: publicationId,
    })).filter(isAlphabetReadRow);
    const first = rows[0];
    if (!first || rows.length !== first.question_count) return null;

    let resultRows: AlphabetResultRow[] = [];
    if (first.own_attempt_status === "completed" && first.own_attempt_id) {
      resultRows = (await callAlphabetRead("get_my_alphabet_result", {
        target_attempt_id: first.own_attempt_id,
      })).filter(isAlphabetResultRow);
    }
    const result = resultRows.length ? toResult(resultRows) : undefined;
    const terminalReview: ServerFlashTerminalReview[] | undefined = resultRows.length
      ? resultRows.map((row) => ({
          challengeItemId: row.challenge_item_id,
          publicPayload: row.public_payload,
          solutionPayload: row.solution_payload,
        }))
      : undefined;
    const challenge: ServerAlphabetChallenge = {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "alphabet",
      timeLimitMs: first.global_time_limit_ms,
      entries: rows.map((row) => ({
        id: row.challenge_item_id,
        position: row.item_position,
        letter: row.alphabet_letter,
        questionType: "short-text",
        payloadSchemaVersion: row.payload_schema_version,
        timeLimitMs: row.time_limit_ms,
        points: row.item_points,
      })),
      maxScore: first.challenge_max_score,
    };
    return {
      challenge,
      roomContext: toRoomContext(first, viewer.playerId, result),
      socialSnapshot: {
        currentPlayer: {
          id: viewer.playerId,
          displayName: viewer.name,
          initials: viewer.name.slice(0, 2).toUpperCase(),
          tone: "social" as const,
        },
        players: [],
        peers: [],
      },
      gameplayPersistence: "server" as const,
      ...(terminalReview ? { terminalReview } : {}),
    };
  }

  async getTerminalReview(attemptId: string) {
    return (await callAlphabetRead("get_my_alphabet_result", {
      target_attempt_id: attemptId,
    })).filter(isAlphabetResultRow);
  }
}

export const supabaseAlphabetQueries = new SupabaseAlphabetQueries();
