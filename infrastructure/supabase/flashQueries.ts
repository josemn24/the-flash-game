import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AnswerResult,
  FlashChallenge,
  Question,
  RoomChallengeResult,
} from "@/types/game";
import type { GameRoomContext } from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";

export type FlashReadRow = {
  room_id: string;
  room_slug: string;
  room_title: string;
  publication_id: string;
  publication_status: "scheduled" | "open" | "closed" | "cancelled";
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
  question_type: "multiple-choice";
  payload_schema_version: number;
  public_payload: unknown;
  time_limit_ms: number;
  item_points: number;
};

export type FlashResultRow = {
  attempt_id: string;
  scheduled_challenge_id: string;
  challenge_item_id: string;
  item_position: number;
  question_version_id: string;
  question_type: "multiple-choice";
  payload_schema_version: number;
  public_payload: unknown;
  solution_payload: unknown;
  answer: unknown;
  answer_status: AnswerResult["status"];
  points: number;
  result_details: AnswerResult["details"] | null;
  presented_at: string;
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFlashReadRow(value: unknown): value is FlashReadRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.room_id === "string" &&
    typeof value.room_slug === "string" &&
    typeof value.room_title === "string" &&
    typeof value.publication_id === "string" &&
    (value.publication_status === "open" || value.publication_status === "closed") &&
    typeof value.challenge_id === "string" &&
    typeof value.challenge_version_id === "string" &&
    typeof value.challenge_title === "string" &&
    typeof value.challenge_subtitle === "string" &&
    typeof value.challenge_description === "string" &&
    value.challenge_mode === "flash" &&
    value.challenge_max_score === 100 &&
    typeof value.question_count === "number" &&
    (value.own_attempt_id === null || typeof value.own_attempt_id === "string") &&
    (value.own_attempt_status === null || typeof value.own_attempt_status === "string") &&
    (value.own_attempt_score === null || typeof value.own_attempt_score === "number") &&
    (value.own_attempt_lock_version === null ||
      typeof value.own_attempt_lock_version === "number") &&
    typeof value.challenge_item_id === "string" &&
    typeof value.item_position === "number" &&
    typeof value.question_version_id === "string" &&
    value.question_type === "multiple-choice" &&
    value.payload_schema_version === 1 &&
    isRecord(value.public_payload) &&
    typeof value.time_limit_ms === "number" &&
    value.time_limit_ms > 0 &&
    value.item_points === 50
  );
}

function isFlashResultRow(value: unknown): value is FlashResultRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.attempt_id === "string" &&
    typeof value.scheduled_challenge_id === "string" &&
    typeof value.challenge_item_id === "string" &&
    typeof value.item_position === "number" &&
    value.question_type === "multiple-choice" &&
    value.payload_schema_version === 1 &&
    isRecord(value.public_payload) &&
    isRecord(value.solution_payload) &&
    (typeof value.answer === "string" || value.answer === null) &&
    ["correct", "partial", "incorrect", "unanswered", "timeout"].includes(
      String(value.answer_status),
    ) &&
    typeof value.points === "number" &&
    typeof value.time_used_ms === "number" &&
    value.attempt_status === "completed" &&
    typeof value.attempt_score === "number"
  );
}

function tagsFromPayload(payload: Record<string, unknown>): Question["tags"] {
  const candidate = payload.tags;
  if (!isRecord(candidate)) {
    return { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] };
  }
  return {
    domains: Array.isArray(candidate.domains)
      ? candidate.domains.filter((x): x is string => typeof x === "string")
      : [],
    topics: Array.isArray(candidate.topics)
      ? candidate.topics.filter((x): x is string => typeof x === "string")
      : [],
    cognitiveSkills: Array.isArray(candidate.cognitiveSkills)
      ? candidate.cognitiveSkills.filter((x): x is string => typeof x === "string")
      : [],
    formatSkills: Array.isArray(candidate.formatSkills)
      ? candidate.formatSkills.filter((x): x is string => typeof x === "string")
      : [],
    lifeSkills: Array.isArray(candidate.lifeSkills)
      ? candidate.lifeSkills.filter((x): x is string => typeof x === "string")
      : [],
  } as unknown as Question["tags"];
}

function toQuestion(row: FlashReadRow, result?: FlashResultRow): Question {
  const payload = row.public_payload as Record<string, unknown>;
  const solution = result?.solution_payload as Record<string, unknown> | undefined;
  const prompt = typeof payload.question === "string" ? payload.question : "";
  const options = Array.isArray(payload.options)
    ? payload.options.filter((option): option is string => typeof option === "string")
    : [];
  const question = {
    id: row.challenge_item_id,
    type: "multiple-choice" as const,
    category: typeof payload.category === "string" ? payload.category : "",
    tags: tagsFromPayload(payload),
    question: prompt,
    options,
    timeLimit: row.time_limit_ms / 1000,
    points: row.item_points,
    ...(payload.media && isRecord(payload.media) ? { media: payload.media } : {}),
    ...(payload.promptVisual && isRecord(payload.promptVisual)
      ? { promptVisual: payload.promptVisual }
      : {}),
    ...(solution && typeof solution.correctAnswer === "string"
      ? { correctAnswer: solution.correctAnswer }
      : {}),
    ...(solution && typeof solution.explanation === "string"
      ? { explanation: solution.explanation }
      : {}),
  } as Question;
  return question;
}

async function callFlashRead(
  functionName: "get_my_flash_challenge" | "get_my_flash_result",
  args: Record<string, string>,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase flash read failed (${functionName}): ${error.message}`);
  return Array.isArray(data) ? data : [];
}

function toRoomContext(
  row: FlashReadRow,
  viewerId: string,
  result?: RoomChallengeResult,
): GameRoomContext {
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
          : "available",
    gameplayPersistence: "server",
    ...(result ? { result } : {}),
  };
}

export class SupabaseFlashQueries {
  async getPlayable(roomKey: string, publicationId: string) {
    const viewer = await getCurrentViewerProfile();
    if (!viewer) return null;
    const rows = (
      await callFlashRead("get_my_flash_challenge", {
        target_room_slug: roomKey,
        target_publication_id: publicationId,
      })
    ).filter(isFlashReadRow);
    const first = rows[0];
    if (!first || rows.length !== first.question_count || rows.length !== 2) return null;

    let resultRows: FlashResultRow[] = [];
    if (first.own_attempt_status === "completed" && first.own_attempt_id) {
      resultRows = (
        await callFlashRead("get_my_flash_result", {
          target_attempt_id: first.own_attempt_id,
        })
      ).filter(isFlashResultRow);
    }
    const result = resultRows.length ? this.toResult(resultRows) : undefined;
    const challenge: FlashChallenge = {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "flash",
      questions: rows.map((row) =>
        toQuestion(
          row,
          resultRows.find((item) => item.challenge_item_id === row.challenge_item_id),
        ),
      ),
      questionPoints: Object.fromEntries(
        rows.map((row) => [row.challenge_item_id, row.item_points]),
      ),
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
    };
  }

  toResult(rows: FlashResultRow[]): RoomChallengeResult {
    const first = rows[0]!;
    const answers: AnswerResult[] = rows.map((row) => ({
      questionId: row.challenge_item_id,
      answer: row.answer as AnswerResult["answer"],
      status: row.answer_status,
      isCorrect: row.answer_status === "correct" || row.answer_status === "partial",
      points: row.points,
      timeUsed: row.time_used_ms / 1000,
      ...(row.result_details ? { details: row.result_details } : {}),
    }));
    return {
      flashPoints: first.attempt_score,
      completed: true,
      attempt: {
        challengeId: first.scheduled_challenge_id,
        startedAt: first.attempt_started_at,
        playedAt: first.attempt_completed_at,
        flashPoints: first.attempt_score,
        completed: true,
        durationMs: rows.reduce((sum, row) => sum + row.time_used_ms, 0),
        answers,
      },
    };
  }

  async getResult(attemptId: string) {
    const rows = await this.getTerminalReview(attemptId);
    return rows.length ? this.toResult(rows) : null;
  }

  async getTerminalReview(attemptId: string) {
    return (
      await callFlashRead("get_my_flash_result", {
        target_attempt_id: attemptId,
      })
    ).filter(isFlashResultRow);
  }
}

export const supabaseFlashQueries = new SupabaseFlashQueries();
