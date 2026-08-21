import type {
  AnswerResultDetails,
  AnswerValue,
  Question,
  WordHashtagAnswer,
  WordHashtagQuestion,
} from "@/types/game";
import {
  calculateWordHashtagMetrics,
  isValidWordHashtagConfiguration,
  isWordHashtagAnswer,
} from "@/lib/wordHashtag";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

const EXTRA_MOVE_PENALTY_RATIO = 0.1;

function asQuestion(question: Question) {
  return question as WordHashtagQuestion;
}

function detailsFor(question: WordHashtagQuestion, answer: WordHashtagAnswer): AnswerResultDetails {
  const metrics = calculateWordHashtagMetrics(question, answer);
  return {
    type: "word-hashtag",
    correctCells: metrics.correctCells,
    totalCells: metrics.totalCells,
    completedWords: metrics.completedWords,
    totalWords: metrics.totalWords,
    movesUsed: metrics.movesUsed,
    movesRemaining: metrics.movesRemaining,
    optimalMoves: metrics.optimalMoves,
    solved: metrics.solved,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  const hashtagQuestion = asQuestion(question);
  return (
    isWordHashtagAnswer(answer) &&
    isValidWordHashtagConfiguration(hashtagQuestion) &&
    calculateWordHashtagMetrics(hashtagQuestion, answer).solved
  );
}

export function evaluateWordHashtag({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const hashtagQuestion = asQuestion(question);
  if (!isWordHashtagAnswer(answer) || !isValidWordHashtagConfiguration(hashtagQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateWordHashtagMetrics(hashtagQuestion, answer);
  const details = detailsFor(hashtagQuestion, answer);
  if (!metrics.valid || !metrics.solved) {
    return { isCorrect: false, status: "incorrect", points: 0, details };
  }

  const speedScore = Math.round(
    hashtagQuestion.points * calculateSpeedMultiplier(timeUsed, hashtagQuestion.timeLimit),
  );
  const extraMoves = Math.max(0, metrics.movesUsed - metrics.optimalMoves);
  const movementPenalty =
    Math.round(hashtagQuestion.points * EXTRA_MOVE_PENALTY_RATIO) * extraMoves;
  return {
    isCorrect: true,
    status: "correct",
    points: Math.max(0, speedScore - movementPenalty),
    details,
  };
}

export const scoring = {
  questionType: "word-hashtag",
  policy: "movement-penalty",
  timeoutPolicy: {
    answerSource: "draft",
    unansweredDetails: (question) => detailsFor(question as WordHashtagQuestion, { swaps: [] }),
    status: () => "unanswered",
  },
  isAnswer: isWordHashtagAnswer,
  isCorrect,
  evaluate: evaluateWordHashtag,
} as const satisfies QuestionScoring;
