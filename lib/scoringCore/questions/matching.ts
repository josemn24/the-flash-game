import type { AnswerValue, MatchingAnswer, MatchingQuestion, Question } from "@/types/game";
import {
  applyAttemptPenalty,
  calculateProportionalScore,
  calculateSpeedMultiplier,
} from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): MatchingQuestion {
  return question as MatchingQuestion;
}

export function isMatchingAnswer(answer: AnswerValue | null): answer is MatchingAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    !("stepId" in answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

export function calculateMatchingMetrics(question: MatchingQuestion, answer: MatchingAnswer) {
  const correctPairs = question.leftItems.filter(
    (item) => answer[item.id] === item.correctMatchId,
  ).length;
  return { correctPairs, totalPairs: question.leftItems.length };
}

function isCorrect(question: Question, answer: AnswerValue) {
  const matchingQuestion = asQuestion(question);
  return (
    isMatchingAnswer(answer) &&
    calculateMatchingMetrics(matchingQuestion, answer).correctPairs ===
      matchingQuestion.leftItems.length
  );
}

export function evaluateMatching({
  question,
  answer,
  timeUsed,
  incorrectAttempts,
}: EvaluationContext): InternalEvaluation {
  const matchingQuestion = asQuestion(question);
  const correct = isCorrect(question, answer);
  if (!isMatchingAnswer(answer)) {
    return { isCorrect: correct, status: "incorrect", points: 0 };
  }

  const metrics = calculateMatchingMetrics(matchingQuestion, answer);
  const partialScore = calculateProportionalScore(
    matchingQuestion.points,
    metrics.correctPairs,
    metrics.totalPairs,
    calculateSpeedMultiplier(timeUsed, matchingQuestion.timeLimit),
  );
  return {
    isCorrect: correct,
    status: correct ? "correct" : metrics.correctPairs > 0 ? "partial" : "incorrect",
    points: applyAttemptPenalty(partialScore, matchingQuestion.points, incorrectAttempts),
    details: { type: "matching", ...metrics, incorrectAttempts },
  };
}

export const scoring = {
  questionType: "matching",
  policy: "partial-items",
  preserveTimedOutPoints: true,
  isAnswer: isMatchingAnswer,
  isCorrect,
  evaluate: evaluateMatching,
  timedOutStatus: (evaluation) =>
    evaluation.details?.type === "matching" && evaluation.details.correctPairs === 0
      ? "unanswered"
      : undefined,
} as const satisfies QuestionScoring;
