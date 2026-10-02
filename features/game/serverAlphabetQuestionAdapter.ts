import { questionWithSolution as shortTextWithSolution } from "@/features/question-formats/formats/short-text/review";
import { hasOnlyKeys, shortTextPublicPayloadKeys } from "@/lib/question-formats/stored-common";
import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import { readPublic } from "@/lib/question-formats/short-text/public";
import type {
  AlphabetChallenge,
  ServerAlphabetChallenge,
  ServerAlphabetQuestion,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { ShortTextQuestion } from "@/types/gameplay/practice";

export class ServerAlphabetQuestionError extends Error {
  constructor() {
    super("invalid_alphabet_question_payload");
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ServerAlphabetQuestionError();
  }
  return value as Record<string, unknown>;
}

export function questionFromAlphabetPayload(
  id: string,
  letter: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
): ServerAlphabetQuestion {
  const value = record(payload);
  if (!hasOnlyKeys(value, shortTextPublicPayloadKeys)) {
    throw new ServerAlphabetQuestionError();
  }
  const prompt = value.question ?? value.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new ServerAlphabetQuestionError();
  }
  if (
    value.answerPlaceholder !== undefined &&
    value.answerPlaceholder !== null &&
    typeof value.answerPlaceholder !== "string"
  ) {
    throw new ServerAlphabetQuestionError();
  }
  return { ...readPublic({ id, payload, timeLimitMs, points }), letter };
}

function questionWithSolution(
  question: ServerAlphabetQuestion,
  row?: ServerFlashTerminalReview,
): ShortTextQuestion {
  try {
    const reviewed = shortTextWithSolution(question, row);
    const { letter, ...result } = reviewed as ShortTextQuestion & { letter?: string };
    void letter;
    return result;
  } catch (error) {
    if (error instanceof ServerFlashQuestionError) throw new ServerAlphabetQuestionError();
    throw error;
  }
}

export function alphabetChallengeWithReview(
  challenge: ServerAlphabetChallenge,
  review: readonly ServerFlashTerminalReview[],
): AlphabetChallenge {
  return {
    id: challenge.id,
    definitionId: challenge.definitionId,
    number: challenge.number,
    title: challenge.title,
    subtitle: challenge.subtitle,
    description: challenge.description,
    mode: "alphabet",
    timeLimit: challenge.timeLimitMs / 1000,
    entries: challenge.entries.map((entry) => {
      const row = review.find((item) => item.challengeItemId === entry.id);
      const question = questionFromAlphabetPayload(
        entry.id,
        entry.letter,
        row?.publicPayload,
        entry.timeLimitMs,
        entry.points,
      );
      return { letter: entry.letter, question: questionWithSolution(question, row) };
    }),
  };
}
