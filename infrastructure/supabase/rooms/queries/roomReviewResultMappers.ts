import type { AnswerReview } from "@/types/gameplay/completion";
import type { AnswerResult } from "@/types/gameplay/result";
import type { RoomMemberReviewReadRow } from "./roomReadContracts";

export function toHistoricalAnswerReview(row: RoomMemberReviewReadRow): AnswerReview {
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
    ...(row.result_details ? { details: row.result_details as AnswerReview["details"] } : {}),
  };
}

export function toAnswerResult(review: AnswerReview): AnswerResult {
  return {
    questionId: review.questionId,
    answer: review.answer,
    status: review.status,
    isCorrect: review.isCorrect,
    points: review.points ?? 0,
    timeUsed: review.timeUsed ?? 0,
    details: review.details,
  };
}

export function toHistoricalResult(rows: RoomMemberReviewReadRow[]) {
  const first = rows[0];
  if (!first) return null;
  const answers: AnswerReview[] = rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map(toHistoricalAnswerReview);
  const durationMs = rows.reduce((total, row) => total + (row.time_used_ms ?? 0), 0);
  const completed = first.attempt_status === "completed";
  return {
    flashPoints: first.attempt_score ?? 0,
    completed,
    attempt: {
      challengeId: first.publication_id,
      startedAt: first.attempt_started_at,
      playedAt: first.attempt_completed_at ?? first.attempt_started_at,
      durationMs: first.attempt_duration_ms ?? durationMs,
      flashPoints: first.attempt_score ?? 0,
      completed,
      answers,
    },
  };
}
