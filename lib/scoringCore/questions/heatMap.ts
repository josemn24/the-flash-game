import type { AnswerValue, HeatMapAnswer, HeatMapQuestion, Question } from "@/types/game";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): HeatMapQuestion {
  return question as HeatMapQuestion;
}

export function isHeatMapAnswer(answer: AnswerValue | null): answer is HeatMapAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "x" in answer &&
    "y" in answer &&
    typeof answer.x === "number" &&
    Number.isFinite(answer.x) &&
    typeof answer.y === "number" &&
    Number.isFinite(answer.y)
  );
}

function clampNormalizedCoordinate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function safeNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateHeatMapMetrics(question: HeatMapQuestion, answer: HeatMapAnswer) {
  const selectedPoint = {
    x: clampNormalizedCoordinate(answer.x),
    y: clampNormalizedCoordinate(answer.y),
  };
  const targetPoint = {
    x: clampNormalizedCoordinate(question.target.x),
    y: clampNormalizedCoordinate(question.target.y),
  };
  const width = Math.max(1, safeNonNegative(Math.abs(question.surface.width)));
  const height = Math.max(1, safeNonNegative(Math.abs(question.surface.height)));
  const shortSide = Math.min(width, height);
  const distance = Math.hypot(
    (selectedPoint.x - targetPoint.x) * (width / shortSide),
    (selectedPoint.y - targetPoint.y) * (height / shortSide),
  );
  const fullCreditRadius = safeNonNegative(question.fullCreditRadius);
  const toleranceRadius = Math.max(fullCreditRadius, safeNonNegative(question.toleranceRadius));
  const accuracy =
    distance <= fullCreditRadius
      ? 1
      : toleranceRadius <= fullCreditRadius || distance >= toleranceRadius
        ? 0
        : 1 - (distance - fullCreditRadius) / (toleranceRadius - fullCreditRadius);

  return { selectedPoint, targetPoint, distance, accuracy };
}

function isCorrect(question: Question, answer: AnswerValue) {
  return (
    isHeatMapAnswer(answer) && calculateHeatMapMetrics(asQuestion(question), answer).accuracy === 1
  );
}

export function evaluateHeatMap({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const heatQuestion = asQuestion(question);
  if (!isHeatMapAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateHeatMapMetrics(heatQuestion, answer);
  const correct = metrics.accuracy === 1;
  return {
    isCorrect: correct,
    status: correct ? "correct" : metrics.accuracy > 0 ? "partial" : "incorrect",
    points: Math.max(
      0,
      Math.round(
        heatQuestion.points *
          metrics.accuracy *
          calculateSpeedMultiplier(timeUsed, heatQuestion.timeLimit),
      ),
    ),
    details: {
      type: "heat-map",
      ...metrics,
    },
  };
}

export const scoring = {
  questionType: "heat-map",
  policy: "spatial-proximity",
  isAnswer: isHeatMapAnswer,
  isCorrect,
  evaluate: evaluateHeatMap,
  timedOutStatus: () => "unanswered",
} as const satisfies QuestionScoring;
