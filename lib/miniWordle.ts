import type { MiniWordleQuestion } from "@/types/game";

export const DEFAULT_MINI_WORDLE_WORD_LENGTH = 4;
export const DEFAULT_MINI_WORDLE_MAX_ATTEMPTS = 4;
export const MINI_WORDLE_WORD_LENGTH = DEFAULT_MINI_WORDLE_WORD_LENGTH;
export const MINI_WORDLE_MAX_ATTEMPTS = DEFAULT_MINI_WORDLE_MAX_ATTEMPTS;
export const MINI_WORDLE_WORD_LENGTHS = [4, 5] as const;
export const MINI_WORDLE_MIN_ATTEMPTS = 1;
export const MINI_WORDLE_MAX_ALLOWED_ATTEMPTS = 10;

export type MiniWordleWordLength = (typeof MINI_WORDLE_WORD_LENGTHS)[number];

export type MiniWordleLetterStatus = "correct" | "present" | "absent";

export type MiniWordleLetterFeedback = {
  letter: string;
  status: MiniWordleLetterStatus;
};

export function isMiniWordleWordLength(value: unknown): value is MiniWordleWordLength {
  return MINI_WORDLE_WORD_LENGTHS.includes(value as MiniWordleWordLength);
}

export function isMiniWordleMaxAttempts(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= MINI_WORDLE_MIN_ATTEMPTS &&
    Number(value) <= MINI_WORDLE_MAX_ALLOWED_ATTEMPTS
  );
}

export function getMiniWordleWordLength(
  question: Pick<MiniWordleQuestion, "wordLength">,
): MiniWordleWordLength {
  return question.wordLength ?? DEFAULT_MINI_WORDLE_WORD_LENGTH;
}

export function getMiniWordleMaxAttempts(question: Pick<MiniWordleQuestion, "maxAttempts">) {
  return question.maxAttempts ?? DEFAULT_MINI_WORDLE_MAX_ATTEMPTS;
}

export function normalizeMiniWordleWord(value: string) {
  return value
    .trim()
    .toLocaleUpperCase("es-ES")
    .normalize("NFD")
    .replace(/N\u0303/g, "Ñ")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isValidMiniWordleWord(
  value: string,
  wordLength: MiniWordleWordLength = DEFAULT_MINI_WORDLE_WORD_LENGTH,
) {
  const normalized = normalizeMiniWordleWord(value);
  return Array.from(normalized).length === wordLength && /^[A-ZÑ]+$/.test(normalized);
}

export function isValidMiniWordleConfiguration(question: MiniWordleQuestion) {
  if (
    (question.wordLength !== undefined && !isMiniWordleWordLength(question.wordLength)) ||
    (question.maxAttempts !== undefined && !isMiniWordleMaxAttempts(question.maxAttempts))
  ) {
    return false;
  }

  const wordLength = getMiniWordleWordLength(question);
  const solution = normalizeMiniWordleWord(question.correctAnswer);
  const additionalGuesses = (question.additionalGuesses ?? []).map(normalizeMiniWordleWord);
  return (
    isValidMiniWordleWord(question.correctAnswer, wordLength) &&
    (question.additionalGuesses ?? []).every((guess) => isValidMiniWordleWord(guess, wordLength)) &&
    new Set(additionalGuesses).size === additionalGuesses.length &&
    !additionalGuesses.includes(solution)
  );
}

export function getMiniWordleFeedback(
  guessValue: string,
  solutionValue: string,
): MiniWordleLetterFeedback[] {
  const guess = Array.from(normalizeMiniWordleWord(guessValue));
  const solution = Array.from(normalizeMiniWordleWord(solutionValue));
  const feedback: MiniWordleLetterFeedback[] = guess.map((letter) => ({
    letter,
    status: "absent",
  }));
  const remaining = new Map<string, number>();

  guess.forEach((letter, index) => {
    if (letter === solution[index]) {
      feedback[index].status = "correct";
      return;
    }
    const solutionLetter = solution[index];
    remaining.set(solutionLetter, (remaining.get(solutionLetter) ?? 0) + 1);
  });

  guess.forEach((letter, index) => {
    if (feedback[index].status === "correct") return;
    const available = remaining.get(letter) ?? 0;
    if (available > 0) {
      feedback[index].status = "present";
      remaining.set(letter, available - 1);
    }
  });

  return feedback;
}
