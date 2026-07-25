import type { AnagramQuestion, AnswerValue, Question } from "@/types/game";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): AnagramQuestion {
  return question as AnagramQuestion;
}

export function isValidAnagramConfiguration(question: AnagramQuestion) {
  const tileIds = question.tiles.map((tile) => tile.id);
  const solutionLetters = Array.from(question.correctAnswer.trim());
  const tileLetters = question.tiles.map((tile) => tile.value);
  const countLetters = (letters: string[]) =>
    [...letters].sort((left, right) => left.localeCompare(right, "es")).join("");
  return (
    question.tiles.length >= 3 &&
    question.tiles.length <= 10 &&
    Boolean(question.correctAnswer.trim()) &&
    !/\s/.test(question.correctAnswer) &&
    solutionLetters.length === question.tiles.length &&
    new Set(tileIds).size === tileIds.length &&
    question.tiles.every(
      (tile) =>
        Boolean(tile.id.trim()) &&
        Array.from(tile.value).length === 1 &&
        Boolean(tile.value.trim()),
    ) &&
    countLetters(solutionLetters) === countLetters(tileLetters) &&
    tileLetters.join("") !== question.correctAnswer
  );
}

function isCorrect(question: Question, answer: AnswerValue) {
  const anagramQuestion = asQuestion(question);
  return (
    typeof answer === "string" &&
    isValidAnagramConfiguration(anagramQuestion) &&
    normalizeAnswer(answer) === normalizeAnswer(anagramQuestion.correctAnswer)
  );
}

export function evaluateAnagram({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const correct = isCorrect(question, answer);
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points: calculateQuestionScore(question, correct, timeUsed),
  };
}

export const scoring = {
  questionType: "anagram",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateAnagram,
} as const satisfies QuestionScoring;
