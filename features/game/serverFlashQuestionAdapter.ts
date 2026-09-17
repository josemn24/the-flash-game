import type { FlashChallenge, LogicCodeQuestion, MiniWordleQuestion, QuestionOfType } from "@/types/game";
import type {
  ServerFlashChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
  ServerLogicCodeQuestion,
} from "@/types/gameplay/challenge";
import type { MiniWordleLetterFeedback } from "@/lib/miniWordle";

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
): QuestionOfType<"multiple-choice">;
export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
  questionType: "multiple-choice" | "mini-wordle" | "logic-code",
  progress?: unknown,
): ServerFlashQuestion;
export function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
  questionType?: "multiple-choice" | "mini-wordle" | "logic-code",
  progress?: unknown,
): ServerFlashQuestion | QuestionOfType<"multiple-choice"> {
  const value = payloadRecord(payload);
  const prompt = value.question ?? value.prompt;
  if (typeof prompt !== "string") throw new ServerFlashQuestionError();
  const base = {
    id,
    category: typeof value.category === "string" ? value.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: prompt,
    timeLimit: timeLimitMs / 1000,
    points,
  } as const;
  if (questionType === undefined) {
    if (!Array.isArray(value.options) || !value.options.every((option) => typeof option === "string")) {
      throw new ServerFlashQuestionError();
    }
    return {
      ...base,
      type: "multiple-choice",
      options: value.options,
      correctAnswer: "",
      explanation: "",
    };
  }
  if (questionType === "multiple-choice") {
    if (!Array.isArray(value.options) || !value.options.every((option) => typeof option === "string")) {
      throw new ServerFlashQuestionError();
    }
    return { ...base, type: "multiple-choice", options: value.options };
  }
  if (questionType === "logic-code") {
    const clues = value.clues;
    const codeLength = value.codeLength;
    if (
      !Array.isArray(clues) ||
      clues.length === 0 ||
      typeof codeLength !== "number" ||
      !Number.isSafeInteger(codeLength) ||
      codeLength < 1 ||
      codeLength > 12 ||
      !clues.every((clue) => {
        if (!clue || typeof clue !== "object" || Array.isArray(clue)) return false;
        const item = clue as Record<string, unknown>;
        return (
          typeof item.code === "string" &&
          typeof item.hint === "string" &&
          item.code.length === codeLength
        );
      })
    ) {
      throw new ServerFlashQuestionError();
    }
    const rawProgress = progress && typeof progress === "object" && !Array.isArray(progress)
      ? progress as Record<string, unknown>
      : {};
    const submittedCodes = Array.isArray(rawProgress.submittedCodes)
      ? rawProgress.submittedCodes.filter((code): code is string => typeof code === "string")
      : [];
    return {
      ...base,
      type: "logic-code",
      clues: clues as ServerLogicCodeQuestion["clues"],
      codeLength,
      progress: {
        kind: "logic-code",
        submittedCodes,
        incorrectAttempts:
          typeof rawProgress.incorrectAttempts === "number"
            ? rawProgress.incorrectAttempts
            : submittedCodes.length,
      },
    };
  }
  const wordLength = value.wordLength;
  const maxAttempts = value.maxAttempts;
  if ((wordLength !== 4 && wordLength !== 5) || typeof maxAttempts !== "number") {
    throw new ServerFlashQuestionError();
  }
  const rawProgress = progress && typeof progress === "object" && !Array.isArray(progress)
    ? progress as Record<string, unknown>
    : {};
  const guesses = Array.isArray(rawProgress.guesses)
    ? rawProgress.guesses.filter((guess): guess is string => typeof guess === "string")
    : [];
  const feedback = Array.isArray(rawProgress.feedback)
    ? rawProgress.feedback as MiniWordleLetterFeedback[][]
    : [];
  return {
    ...base,
    type: "mini-wordle",
    hint: typeof value.hint === "string" ? value.hint : null,
    wordLength,
    maxAttempts,
    progress: {
      kind: "mini-wordle",
      guesses,
      feedback,
      attemptsUsed: typeof rawProgress.attemptsUsed === "number" ? rawProgress.attemptsUsed : guesses.length,
      maxAttempts,
    },
  };
}

function questionWithSolution(
  question: ServerFlashQuestion,
  row?: ServerFlashTerminalReview,
): QuestionOfType<"multiple-choice"> | MiniWordleQuestion | LogicCodeQuestion {
  const solution = row?.solutionPayload && typeof row.solutionPayload === "object"
    ? row.solutionPayload as Record<string, unknown>
    : {};
  if (question.type === "mini-wordle") {
    if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
    return {
      id: question.id,
      type: "mini-wordle",
      category: question.category,
      tags: question.tags,
      question: question.question,
      hint: question.hint ?? undefined,
      wordLength: question.wordLength,
      maxAttempts: question.maxAttempts,
      correctAnswer: solution.correctAnswer,
      additionalGuesses: Array.isArray(solution.additionalGuesses)
        ? solution.additionalGuesses.filter((guess): guess is string => typeof guess === "string")
        : [],
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  if (question.type === "logic-code") {
    if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
    return {
      id: question.id,
      type: "logic-code",
      category: question.category,
      tags: question.tags,
      question: question.question,
      clues: [...question.clues],
      codeLength: question.codeLength,
      correctAnswer: solution.correctAnswer,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: typeof solution.explanation === "string" ? solution.explanation : "",
    };
  }
  return {
    id: question.id,
    type: "multiple-choice",
    category: question.category,
    tags: question.tags,
    question: question.question,
    options: [...question.options],
    timeLimit: question.timeLimit,
    points: question.points,
    ...(typeof solution.correctAnswer === "string"
      ? { correctAnswer: solution.correctAnswer }
      : { correctAnswer: "" }),
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}

export function displayChallenge(challenge: ServerFlashChallenge): FlashChallenge {
  const { slots, ...challengeBase } = challenge;
  return {
    ...challengeBase,
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
        questionFromPayload(slot.id, row?.publicPayload, slot.timeLimitMs, slot.points, slot.questionType),
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
