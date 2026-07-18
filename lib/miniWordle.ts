import type { MiniWordleQuestion } from "@/types/game";

export const MINI_WORDLE_WORD_LENGTH = 4;
export const MINI_WORDLE_MAX_ATTEMPTS = 4;

export type MiniWordleLetterStatus = "correct" | "present" | "absent";

export type MiniWordleLetterFeedback = {
  letter: string;
  status: MiniWordleLetterStatus;
};

export function normalizeMiniWordleWord(value: string) {
  return value
    .trim()
    .toLocaleUpperCase("es-ES")
    .normalize("NFD")
    .replace(/N\u0303/g, "Ñ")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isValidMiniWordleWord(value: string) {
  const normalized = normalizeMiniWordleWord(value);
  return Array.from(normalized).length === MINI_WORDLE_WORD_LENGTH && /^[A-ZÑ]+$/.test(normalized);
}

export function isValidMiniWordleConfiguration(question: MiniWordleQuestion) {
  const solution = normalizeMiniWordleWord(question.correctAnswer);
  const additionalGuesses = (question.additionalGuesses ?? []).map(normalizeMiniWordleWord);
  return (
    isValidMiniWordleWord(question.correctAnswer) &&
    (question.additionalGuesses ?? []).every(isValidMiniWordleWord) &&
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
