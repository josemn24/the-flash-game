import { reviewQuestion as questionWithSolution } from "@/features/question-formats/reviewRegistry";
import {
  publicEnvelope,
  questionMedia,
  ServerFlashQuestionError,
} from "@/lib/question-formats/public-common";
import { PUBLIC_READERS } from "@/lib/question-formats/publicRegistry";
import type {
  FlashChallenge,
  PyramidChallenge,
  ServerFlashChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
  ServerPyramidChallenge,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export { reviewQuestion as questionWithSolution } from "@/features/question-formats/reviewRegistry";
export { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
type TerminalReviewResponseRow = {
  readonly challengeItemId?: unknown;
  readonly challenge_item_id?: unknown;
  readonly publicPayload?: unknown;
  readonly public_payload?: unknown;
  readonly solutionPayload?: unknown;
  readonly solution_payload?: unknown;
};
export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
): PracticeQuestionOfType<"multiple-choice">;
export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
  questionType: ServerFlashQuestion["type"],
  progress?: unknown,
  allowCompleteProgress?: boolean,
): ServerFlashQuestion;
export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
  questionType?: ServerFlashQuestion["type"],
  progress?: unknown,
  allowCompleteProgress = false,
): ServerFlashQuestion | PracticeQuestionOfType<"multiple-choice"> {
  if (questionType === undefined) {
    const { value, base } = publicEnvelope({ id, payload, timeLimitMs, points });
    if (
      !Array.isArray(value.options) ||
      !value.options.every((option) => typeof option === "string")
    ) {
      throw new ServerFlashQuestionError();
    }
    const media = questionMedia(value);
    return {
      ...base,
      type: "multiple-choice",
      options: value.options,
      ...(media ? { media } : {}),
      correctAnswer: "",
      explanation: "",
    };
  }
  return PUBLIC_READERS[questionType]({
    id,
    payload,
    timeLimitMs,
    points,
    progress,
    allowCompleteProgress,
  });
}

type ServerPlayableChallenge =
  ServerFlashChallenge | ServerSurvivalChallenge | ServerPyramidChallenge;

export function displayChallenge(challenge: ServerPlayableChallenge): FlashChallenge {
  const slots = challenge.mode === "pyramid" ? challenge.levels : challenge.slots;
  return {
    id: challenge.id,
    definitionId: challenge.definitionId,
    number: challenge.number,
    title: challenge.title,
    subtitle: challenge.subtitle,
    description: challenge.description,
    mode: "flash",
    questions: slots.map((slot) => ({
      id: slot.id,
      type: "multiple-choice" as const,
      category: "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      question: "",
      options: [],
      correctAnswer: "",
      timeLimit: slot.timeLimitMs / 1000,
      points: slot.points,
      explanation: "",
    })),
  };
}

export function challengeWithReview(
  challenge: ServerFlashChallenge | ServerSurvivalChallenge,
  review: readonly ServerFlashTerminalReview[],
): FlashChallenge;
export function challengeWithReview(
  challenge: ServerPyramidChallenge,
  review: readonly ServerFlashTerminalReview[],
): PyramidChallenge;
export function challengeWithReview(
  challenge: ServerPlayableChallenge,
  review: readonly ServerFlashTerminalReview[],
): FlashChallenge | PyramidChallenge {
  if (challenge.mode === "pyramid") {
    const levels = challenge.levels.flatMap((level) => {
      const row = review.find((item) => item.challengeItemId === level.id);
      if (!row) return [];
      const question = questionFromPayload(
        level.id,
        row.publicPayload,
        level.timeLimitMs,
        level.points,
        level.questionType,
        undefined,
        true,
      );
      return [
        {
          id: level.levelId,
          label: level.label,
          briefing: level.briefing,
          question: questionWithSolution(question, row),
        },
      ];
    });
    const questionPoints = Object.fromEntries(
      levels.map((level) => [level.question.id, level.question.points]),
    );
    return {
      id: challenge.id,
      definitionId: challenge.definitionId,
      number: challenge.number,
      title: challenge.title,
      subtitle: challenge.subtitle,
      description: challenge.description,
      mode: "pyramid",
      attemptVersion: challenge.attemptVersion,
      availableFrom: challenge.availableFrom,
      availableUntil: challenge.availableUntil,
      levels,
      questionPoints,
    };
  }
  const { slots, ...challengeBase } = challenge;
  const reviewSlots =
    challenge.mode === "survival"
      ? slots.filter((slot) => review.some((item) => item.challengeItemId === slot.id))
      : slots;
  return {
    ...challengeBase,
    mode: "flash",
    questions: reviewSlots.map((slot) => {
      const row = review.find((item) => item.challengeItemId === slot.id);
      return questionWithSolution(
        questionFromPayload(
          slot.id,
          row?.publicPayload,
          slot.timeLimitMs,
          slot.points,
          slot.questionType,
          undefined,
          true,
        ),
        row,
      );
    }),
  };
}

function isTerminalReviewResponseRow(value: unknown): value is TerminalReviewResponseRow {
  if (!value || typeof value !== "object") return false;
  const row = value as TerminalReviewResponseRow;
  return (
    (typeof row.challenge_item_id === "string" || typeof row.challengeItemId === "string") &&
    ("public_payload" in row || "publicPayload" in row) &&
    ("solution_payload" in row || "solutionPayload" in row)
  );
}

export function terminalReviewFromResponse(value: unknown): ServerFlashTerminalReview[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isTerminalReviewResponseRow).map((row) => ({
    challengeItemId: (row.challenge_item_id ?? row.challengeItemId) as string,
    publicPayload: row.public_payload ?? row.publicPayload,
    solutionPayload: row.solution_payload ?? row.solutionPayload,
  }));
}
