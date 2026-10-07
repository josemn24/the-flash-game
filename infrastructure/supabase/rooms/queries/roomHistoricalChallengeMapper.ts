import { alphabetChallengeWithReview } from "@/lib/gameplay/alphabetReview";
import type { NarrativeChallenge } from "@/types/gameplay/challenge";
import type { PracticeChallenge } from "@/types/gameplay/practice";
import type { RoomMemberReviewReadRow } from "./roomReadContracts";
import { toHistoricalFlashQuestion } from "./roomReviewQuestionMapper";

export function toHistoricalChallenge(rows: RoomMemberReviewReadRow[]): PracticeChallenge {
  const first = rows[0];
  if (!first) throw new Error("Cannot build a historical Flash without rows");
  if (first.challenge_mode === "alphabet") {
    const ordered = rows.slice().sort((left, right) => left.item_position - right.item_position);
    if (
      !first.global_time_limit_ms ||
      ordered.length !== first.question_count ||
      new Set(ordered.map((row) => row.alphabet_letter)).size !== ordered.length ||
      ordered.some((row) => row.question_type !== "short-text" || !row.alphabet_letter)
    ) {
      throw new Error("Invalid historical Alphabet configuration");
    }
    return alphabetChallengeWithReview(
      {
        id: first.publication_id,
        definitionId: first.challenge_slug,
        number: 1,
        title: first.challenge_title,
        subtitle: first.challenge_subtitle,
        description: first.challenge_description,
        mode: "alphabet",
        timeLimitMs: first.global_time_limit_ms,
        maxScore: first.challenge_max_score,
        entries: ordered.map((row) => ({
          id: row.challenge_item_id,
          position: row.item_position,
          letter: row.alphabet_letter!,
          questionType: "short-text",
          payloadSchemaVersion: row.payload_schema_version,
          timeLimitMs: row.time_limit_ms ?? 0,
          points: row.item_points,
        })),
      },
      ordered.map((row) => ({
        challengeItemId: row.challenge_item_id,
        publicPayload: row.public_payload,
        solutionPayload: row.solution_payload,
      })),
    );
  }
  const questions = rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map(toHistoricalFlashQuestion);
  const questionPoints = Object.fromEntries(
    rows.map((row) => [row.challenge_item_id, row.item_points]),
  );
  if (first.challenge_mode === "survival") {
    return {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "survival",
      lives: first.initial_lives ?? 0,
      questions,
      questionPoints,
    };
  }
  if (first.challenge_mode === "narrative") {
    return {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "narrative",
      implementationStatus: "complete",
      maxScore: first.challenge_max_score,
      prologue: { id: "historical-prologue", blocks: [] },
      beats: [
        {
          id: "historical-questions",
          title: "Preguntas",
          steps: questions.map((question) => ({ type: "question", question })),
        },
      ],
    } satisfies NarrativeChallenge;
  }
  if (first.challenge_mode !== "flash") {
    throw new Error(`Cannot build a historical ${first.challenge_mode} Challenge`);
  }
  return {
    id: first.publication_id,
    definitionId: first.challenge_slug,
    number: 1,
    title: first.challenge_title,
    subtitle: first.challenge_subtitle,
    description: first.challenge_description,
    mode: "flash",
    questions,
    questionPoints,
  };
}
