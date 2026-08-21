import type {
  AnswerResultDetails,
  AnswerValue,
  Question,
  WordSearchAnswer,
  WordSearchQuestion,
} from "@/types/game";
import {
  calculateWordSearchMetrics,
  isValidWordSearchConfiguration,
  isWordSearchAnswer,
} from "@/lib/wordSearch";
import { calculateProportionalScore, calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
  UnansweredDetailsContext,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question) {
  return question as WordSearchQuestion;
}

function detailsFor(
  question: WordSearchQuestion,
  answer: WordSearchAnswer,
  incorrectSelections: number,
): AnswerResultDetails {
  const metrics = calculateWordSearchMetrics(question, answer);
  return {
    type: "word-search",
    foundWords: metrics.foundWords,
    totalWords: metrics.totalWords,
    incorrectSelections,
    solved: metrics.solved,
  };
}

function unansweredDetails(
  question: Question,
  context: UnansweredDetailsContext,
): AnswerResultDetails {
  const wordSearchQuestion = asQuestion(question);
  return {
    type: "word-search",
    foundWords: 0,
    totalWords: wordSearchQuestion.targets.length,
    incorrectSelections: context.incorrectAttempts,
    solved: false,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (!isWordSearchAnswer(answer)) return false;
  const wordSearchQuestion = asQuestion(question);
  return (
    isValidWordSearchConfiguration(wordSearchQuestion) &&
    calculateWordSearchMetrics(wordSearchQuestion, answer).solved
  );
}

export function evaluateWordSearch({
  question,
  answer,
  timeUsed,
  incorrectAttempts,
}: EvaluationContext): InternalEvaluation {
  const wordSearchQuestion = asQuestion(question);
  if (!isWordSearchAnswer(answer) || !isValidWordSearchConfiguration(wordSearchQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateWordSearchMetrics(wordSearchQuestion, answer);
  const details = detailsFor(wordSearchQuestion, answer, incorrectAttempts);
  if (!metrics.valid) {
    return { isCorrect: false, status: "incorrect", points: 0, details };
  }

  return {
    isCorrect: metrics.solved,
    status: metrics.solved ? "correct" : metrics.foundWords > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      wordSearchQuestion.points,
      metrics.foundWords,
      metrics.totalWords,
      calculateSpeedMultiplier(timeUsed, wordSearchQuestion.timeLimit),
    ),
    details,
  };
}

export const scoring = {
  questionType: "word-search",
  policy: "partial-items",
  timeoutPolicy: {
    answerSource: "draft",
    preservePoints: true,
    unansweredDetails,
    status: (evaluation) =>
      evaluation.details?.type === "word-search" && evaluation.details.foundWords === 0
        ? "unanswered"
        : undefined,
  },
  isAnswer: isWordSearchAnswer,
  isCorrect,
  evaluate: evaluateWordSearch,
} as const satisfies QuestionScoring;
