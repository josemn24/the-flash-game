import type { AlphabetChallenge, ShortTextQuestion } from "@/types/game";
import type {
  ServerAlphabetChallenge,
  ServerAlphabetQuestion,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";

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
  const allowedKeys = new Set(["category", "tags", "question", "answerPlaceholder"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
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
  return {
    id,
    type: "short-text",
    letter,
    category: typeof value.category === "string" ? value.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], lifeSkills: [], formatSkills: [] },
    question: prompt,
    timeLimit: timeLimitMs / 1000,
    points,
    answerPlaceholder:
      typeof value.answerPlaceholder === "string" ? value.answerPlaceholder : null,
  };
}

function questionWithSolution(
  question: ServerAlphabetQuestion,
  row?: ServerFlashTerminalReview,
): ShortTextQuestion {
  const solution = record(row?.solutionPayload ?? {});
  const correctAnswer = solution.correctAnswer;
  const acceptedAnswers = solution.acceptedAnswers;
  if (
    typeof correctAnswer !== "string" ||
    !Array.isArray(acceptedAnswers) ||
    !acceptedAnswers.every((answer) => typeof answer === "string")
  ) {
    throw new ServerAlphabetQuestionError();
  }
  return {
    id: question.id,
    type: "short-text",
    category: question.category,
    tags: question.tags,
    question: question.question,
    correctAnswer,
    acceptedAnswers,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
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
