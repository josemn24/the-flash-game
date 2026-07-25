import type { AnswerValue, EstimationQuestion, Question } from "@/types/game";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): EstimationQuestion {
  return question as EstimationQuestion;
}

export function calculateEstimationMetrics(question: EstimationQuestion, answer: number) {
  const difference = Math.abs(answer - question.correctAnswer);
  const proximity =
    question.tolerance <= 0
      ? Number(difference === 0)
      : Math.min(1, Math.max(0, 1 - difference / question.tolerance));
  return { difference, proximity };
}

function isCorrect(question: Question, answer: AnswerValue) {
  return typeof answer === "number" && answer === asQuestion(question).correctAnswer;
}

export function evaluateEstimation({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const estimationQuestion = asQuestion(question);
  const correct = isCorrect(question, answer);
  if (typeof answer !== "number") {
    return { isCorrect: correct, status: "partial", points: 0 };
  }

  const metrics = calculateEstimationMetrics(estimationQuestion, answer);
  return {
    isCorrect: correct,
    status: correct ? "correct" : "partial",
    points: Math.max(
      0,
      Math.round(
        estimationQuestion.points *
          metrics.proximity *
          calculateSpeedMultiplier(timeUsed, estimationQuestion.timeLimit),
      ),
    ),
    details: { type: "estimation", ...metrics },
  };
}

export const scoring = {
  questionType: "estimation",
  policy: "proximity",
  isAnswer: (answer) => typeof answer === "number",
  isCorrect,
  evaluate: evaluateEstimation,
} as const satisfies QuestionScoring;
