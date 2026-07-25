import type {
  AnswerResultDetails,
  AnswerValue,
  ConnectPairsAnswer,
  ConnectPairsQuestion,
  Question,
} from "@/types/game";
import {
  calculateConnectPairsMetrics,
  isValidConnectPairsAnswer,
  isValidConnectPairsConfiguration,
} from "@/lib/connectPairs";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): ConnectPairsQuestion {
  return question as ConnectPairsQuestion;
}

export function isConnectPairsAnswer(answer: AnswerValue | null): answer is ConnectPairsAnswer {
  return isValidConnectPairsAnswer(answer);
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (!isConnectPairsAnswer(answer)) return false;
  const metrics = calculateConnectPairsMetrics(asQuestion(question), answer);
  return metrics.valid && metrics.exact;
}

function unansweredDetails(question: Question): AnswerResultDetails {
  const connectQuestion = asQuestion(question);
  return {
    type: "connect-pairs",
    connectedPairs: 0,
    totalPairs: connectQuestion.pairs.length,
    coveredCells: 0,
    totalCells: connectQuestion.grid.rows * connectQuestion.grid.columns,
    coverage: 0,
    conflicts: 0,
  };
}

export function evaluateConnectPairs({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const connectQuestion = asQuestion(question);
  if (!isConnectPairsAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateConnectPairsMetrics(connectQuestion, answer);
  if (!metrics.valid || !isValidConnectPairsConfiguration(connectQuestion)) {
    return {
      isCorrect: false,
      status: "incorrect",
      points: 0,
      details: {
        type: "connect-pairs",
        connectedPairs: 0,
        totalPairs: metrics.totalPairs,
        coveredCells: 0,
        totalCells: metrics.totalCells,
        coverage: 0,
        conflicts: metrics.conflicts,
      },
    };
  }

  const points = Math.round(
    connectQuestion.points *
      metrics.coverageScore *
      calculateSpeedMultiplier(timeUsed, connectQuestion.timeLimit),
  );

  return {
    isCorrect: metrics.exact,
    status: metrics.exact ? "correct" : metrics.coverageScore > 0 ? "partial" : "incorrect",
    points,
    details: {
      type: "connect-pairs",
      connectedPairs: metrics.connectedPairs,
      totalPairs: metrics.totalPairs,
      coveredCells: metrics.coveredCells,
      totalCells: metrics.totalCells,
      coverage: metrics.coverageRatio,
      conflicts: metrics.conflicts,
    },
  };
}

export const scoring = {
  questionType: "connect-pairs",
  policy: "partial-items",
  preserveTimedOutPoints: true,
  timeoutAnswerSource: "draft",
  isAnswer: isConnectPairsAnswer,
  isCorrect,
  evaluate: evaluateConnectPairs,
  unansweredDetails,
  timedOutStatus: (evaluation) =>
    evaluation.details?.type === "connect-pairs" &&
    evaluation.details.connectedPairs === 0 &&
    evaluation.details.coveredCells === 0
      ? "unanswered"
      : undefined,
} as const satisfies QuestionScoring;
