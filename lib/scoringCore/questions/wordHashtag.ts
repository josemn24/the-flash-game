import type {
  AnswerResultDetails,
  ResolvedAnswerValue,
  ResolvedQuestion,
  WordHashtagQuestion,
} from "@/types/gameplay/scoring";
import {
  analyzeWordHashtagAnswer,
  calculateWordHashtagMetrics,
  isWordHashtagAnswer,
  type WordHashtagMetrics,
} from "@/lib/wordHashtag";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

const EXTRA_MOVE_PENALTY_RATIO = 0.1;

function asQuestion(question: ResolvedQuestion) {
  return question as WordHashtagQuestion;
}

function detailsFor(metrics: WordHashtagMetrics): AnswerResultDetails {
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

function isCorrect(question: ResolvedQuestion, answer: ResolvedAnswerValue) {
  const analysis = analyzeWordHashtagAnswer(asQuestion(question), answer);
  return analysis.kind === "analyzed" && analysis.metrics.solved;
}

export function evaluateWordHashtag({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const hashtagQuestion = asQuestion(question);
  const analysis = analyzeWordHashtagAnswer(hashtagQuestion, answer);
  if (analysis.kind !== "analyzed") {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const { metrics } = analysis;
  const details = detailsFor(metrics);
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
    unansweredDetails: (question) =>
      detailsFor(calculateWordHashtagMetrics(asQuestion(question), { swaps: [] })),
    status: () => "unanswered",
  },
  isAnswer: isWordHashtagAnswer,
  isCorrect,
  evaluate: evaluateWordHashtag,
} as const satisfies QuestionScoring;
