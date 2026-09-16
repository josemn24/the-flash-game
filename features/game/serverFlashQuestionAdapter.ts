import type { FlashChallenge, QuestionOfType } from "@/types/game";
import type { ServerFlashChallenge, ServerFlashTerminalReview } from "@/types/gameplay/challenge";

type TerminalReviewResponseRow = {
  challenge_item_id: string;
  public_payload: unknown;
  solution_payload: unknown;
};

export class ServerFlashQuestionError extends Error {
  constructor() {
    super("invalid_question_payload");
  }
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ServerFlashQuestionError();
  }
  return payload as Record<string, unknown>;
}

export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
): QuestionOfType<"multiple-choice"> {
  const value = payloadRecord(payload);
  const prompt = value.question ?? value.prompt;
  if (
    typeof prompt !== "string" ||
    !Array.isArray(value.options) ||
    !value.options.every((option) => typeof option === "string")
  ) {
    throw new ServerFlashQuestionError();
  }

  return {
    id,
    type: "multiple-choice",
    category: typeof value.category === "string" ? value.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: prompt,
    options: value.options,
    correctAnswer: "",
    timeLimit: timeLimitMs / 1000,
    points,
    explanation: "",
  };
}

function questionWithSolution(
  question: QuestionOfType<"multiple-choice">,
  row?: ServerFlashTerminalReview,
): QuestionOfType<"multiple-choice"> {
  if (!row || !row.solutionPayload || typeof row.solutionPayload !== "object") return question;
  const solution = row.solutionPayload as Record<string, unknown>;
  return {
    ...question,
    ...(typeof solution.correctAnswer === "string"
      ? { correctAnswer: solution.correctAnswer }
      : {}),
    ...(typeof solution.explanation === "string" ? { explanation: solution.explanation } : {}),
  };
}

export function displayChallenge(challenge: ServerFlashChallenge): FlashChallenge {
  const { slots, ...challengeBase } = challenge;
  return {
    ...challengeBase,
    mode: "flash",
    questions: slots.map((slot) =>
      questionFromPayload(
        slot.id,
        {
          question: "",
          options: [],
        },
        slot.timeLimitMs,
        slot.points,
      ),
    ),
  };
}

export function challengeWithReview(
  challenge: ServerFlashChallenge,
  review: readonly ServerFlashTerminalReview[],
): FlashChallenge {
  const { slots, ...challengeBase } = challenge;
  return {
    ...challengeBase,
    mode: "flash",
    questions: slots.map((slot) => {
      const row = review.find((item) => item.challengeItemId === slot.id);
      return questionWithSolution(
        questionFromPayload(slot.id, row?.publicPayload, slot.timeLimitMs, slot.points),
        row,
      );
    }),
  };
}

function isTerminalReviewResponseRow(value: unknown): value is TerminalReviewResponseRow {
  if (!value || typeof value !== "object") return false;
  return "challenge_item_id" in value && "solution_payload" in value && "public_payload" in value;
}

export function terminalReviewFromResponse(value: unknown): ServerFlashTerminalReview[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isTerminalReviewResponseRow).map((row) => ({
    challengeItemId: row.challenge_item_id,
    publicPayload: row.public_payload,
    solutionPayload: row.solution_payload,
  }));
}
