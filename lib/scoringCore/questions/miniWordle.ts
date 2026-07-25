import type {
  AnswerResultDetails,
  AnswerValue,
  MiniWordleAnswer,
  MiniWordleQuestion,
  Question,
} from "@/types/game";
import {
  MINI_WORDLE_MAX_ATTEMPTS,
  isValidMiniWordleConfiguration,
  isValidMiniWordleWord,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";
import { applyAttemptPenalty, calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): MiniWordleQuestion {
  return question as MiniWordleQuestion;
}

export function isMiniWordleAnswer(answer: AnswerValue | null): answer is MiniWordleAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "guesses" in answer &&
    Array.isArray(answer.guesses) &&
    answer.guesses.every((guess) => typeof guess === "string")
  );
}

export function calculateMiniWordleMetrics(question: MiniWordleQuestion, answer: MiniWordleAnswer) {
  const normalizedGuesses = answer.guesses.map(normalizeMiniWordleWord);
  const solution = normalizeMiniWordleWord(question.correctAnswer);
  const solutionIndex = normalizedGuesses.indexOf(solution);
  const valid =
    isValidMiniWordleConfiguration(question) &&
    normalizedGuesses.length > 0 &&
    normalizedGuesses.length <= MINI_WORDLE_MAX_ATTEMPTS &&
    answer.guesses.every(isValidMiniWordleWord) &&
    (solutionIndex === -1 || solutionIndex === normalizedGuesses.length - 1);
  const solved = valid && normalizedGuesses.at(-1) === solution;
  const incorrectAttempts = solved ? normalizedGuesses.length - 1 : normalizedGuesses.length;
  return {
    valid,
    solved,
    attemptsUsed: valid ? normalizedGuesses.length : 0,
    incorrectAttempts: valid ? incorrectAttempts : 0,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  return (
    isMiniWordleAnswer(answer) && calculateMiniWordleMetrics(asQuestion(question), answer).solved
  );
}

function unansweredDetails(): AnswerResultDetails {
  return {
    type: "mini-wordle",
    attemptsUsed: 0,
    incorrectAttempts: 0,
    solved: false,
  };
}

export function evaluateMiniWordle({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const wordleQuestion = asQuestion(question);
  if (!isMiniWordleAnswer(answer) || !isValidMiniWordleConfiguration(wordleQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateMiniWordleMetrics(wordleQuestion, answer);
  const details = {
    type: "mini-wordle" as const,
    attemptsUsed: metrics.attemptsUsed,
    incorrectAttempts: metrics.incorrectAttempts,
    solved: metrics.solved,
  };

  if (!metrics.solved) {
    return { isCorrect: false, status: "incorrect", points: 0, details };
  }

  const speedScore = Math.round(
    wordleQuestion.points * calculateSpeedMultiplier(timeUsed, wordleQuestion.timeLimit),
  );
  return {
    isCorrect: true,
    status: "correct",
    points: applyAttemptPenalty(speedScore, wordleQuestion.points, metrics.incorrectAttempts),
    details,
  };
}

export const scoring = {
  questionType: "mini-wordle",
  policy: "attempt-penalty",
  timeoutPolicy: {
    answerSource: "draft",
    unansweredDetails,
    status: () => "unanswered",
  },
  isAnswer: isMiniWordleAnswer,
  isCorrect,
  evaluate: evaluateMiniWordle,
} as const satisfies QuestionScoring;
