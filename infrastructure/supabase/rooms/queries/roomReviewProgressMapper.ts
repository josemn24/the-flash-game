import { assertAttemptLifecycle } from "@/lib/attemptLifecycle";
import { deriveCompetitivePyramidProgress } from "@/lib/gameplay/pyramidProgress";
import { deriveSurvivalProgress } from "@/lib/gameplay/survivalProgress";
import type { RoomMemberReviewProgress } from "@/types/view-models";
import type { RoomMemberReviewReadRow } from "./roomReadContracts";
import { toAnswerResult, toHistoricalAnswerReview } from "./roomReviewResultMappers";

export function toRoomMemberReviewProgress(
  rows: RoomMemberReviewReadRow[],
): RoomMemberReviewProgress | null {
  const first = rows[0];
  if (!first) return null;
  assertAttemptLifecycle({
    challengeMode: first.challenge_mode,
    status: first.attempt_status,
    outcome: first.attempt_outcome,
  });
  const orderedRows = rows.slice().sort((left, right) => left.item_position - right.item_position);
  if (first.challenge_mode === "alphabet") {
    return {
      mode: "alphabet",
      answeredCount: orderedRows.filter((row) => row.has_persisted_answer).length,
      correctCount: orderedRows.filter((row) => row.answer_status === "correct").length,
      totalLetterCount: first.question_count,
    };
  }
  const reviews = orderedRows
    .filter((row) => row.has_persisted_answer || row.challenge_mode === "flash")
    .map(toHistoricalAnswerReview)
    .map(toAnswerResult);
  if (first.challenge_mode === "survival") {
    const progress = deriveSurvivalProgress(
      first.initial_lives ?? 0,
      first.question_count,
      reviews,
    );
    const persistedOutcome =
      first.attempt_status === "completed" &&
      (first.attempt_outcome === "survived" || first.attempt_outcome === "eliminated")
        ? first.attempt_outcome
        : progress.outcome;
    return {
      mode: "survival",
      totalQuestionCount: first.question_count,
      initialLives: first.initial_lives ?? 0,
      ...progress,
      outcome: persistedOutcome,
    };
  }
  if (first.challenge_mode === "pyramid") {
    const progress = deriveCompetitivePyramidProgress(first.question_count, reviews);
    return {
      mode: "pyramid",
      totalLevelCount: first.question_count,
      ...progress,
      outcome:
        first.attempt_status === "completed" &&
        (first.attempt_outcome === "summit" || first.attempt_outcome === "failed")
          ? first.attempt_outcome
          : progress.outcome,
    };
  }
  if (first.challenge_mode === "narrative") {
    return {
      mode: "narrative",
      answeredCount: orderedRows.filter((row) => row.has_persisted_answer).length,
      totalQuestionCount: first.question_count,
    };
  }
  return {
    mode: "flash",
    answeredCount: orderedRows.filter((row) => row.has_persisted_answer).length,
    totalQuestionCount: first.question_count,
  };
}
