import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type {
  AnswerResult,
  AnswerValue,
  ClassificationAnswer,
  EstimationQuestion,
  MatchingAnswer,
  MatchingQuestion,
  Question,
} from "@/types/game";

export type EvaluationInput = {
  question: Question;
  answer: AnswerValue | null;
  timeUsed: number;
  timedOut?: boolean;
  submittedCodes?: string[];
};

export function isClassificationAnswer(answer: AnswerValue | null): answer is ClassificationAnswer {
  return answer !== null && typeof answer === "object" && !Array.isArray(answer);
}

export function isMatchingAnswer(answer: AnswerValue | null): answer is MatchingAnswer {
  return answer !== null && typeof answer === "object" && !Array.isArray(answer);
}

export function calculateMatchingMetrics(question: MatchingQuestion, answer: MatchingAnswer) {
  const correctPairs = question.leftItems.filter(
    (item) => answer[item.id] === item.correctMatchId,
  ).length;
  return { correctPairs, totalPairs: question.leftItems.length };
}

export function isAnswerCorrect(question: Question, answer: AnswerValue): boolean {
  switch (question.type) {
    case "estimation":
      return typeof answer === "number" && answer === question.correctAnswer;
    case "classification":
      return (
        isClassificationAnswer(answer) &&
        question.items.every((item) => answer[item.label] === item.correctCategory)
      );
    case "matching":
      return (
        isMatchingAnswer(answer) &&
        calculateMatchingMetrics(question, answer).correctPairs === question.leftItems.length
      );
    case "ordering":
      return (
        Array.isArray(answer) &&
        answer.length === question.correctOrder.length &&
        answer.every((item, index) => item === question.correctOrder[index])
      );
    case "true-false":
      return answer === question.correctAnswer;
    default: {
      if (typeof answer !== "string") return false;
      const accepted =
        question.type === "short-text"
          ? (question.acceptedAnswers ?? [question.correctAnswer])
          : [question.correctAnswer];
      const normalizedAnswer = normalizeAnswer(answer);
      return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
    }
  }
}

export function calculateEstimationMetrics(question: EstimationQuestion, answer: number) {
  const difference = Math.abs(answer - question.correctAnswer);
  const proximity = Math.min(1, Math.max(0, 1 - difference / question.tolerance));
  return { difference, proximity };
}

export function calculateQuestionScore(question: Question, correct: boolean, timeUsed: number) {
  if (correct) {
    const safeTime = Math.min(Math.max(timeUsed, 0), question.timeLimit);
    const score = Math.round(question.points * (1 - 0.5 * (safeTime / question.timeLimit)));
    return Math.max(score, Math.ceil(question.points * 0.5));
  }

  if (question.type === "true-false") return -Math.round(question.points * 0.4);
  if (
    question.type === "multiple-choice" ||
    question.type === "odd-one-out" ||
    question.type === "ordering"
  ) {
    return -Math.round(question.points * 0.2);
  }
  return 0;
}

export function calculateAnswerScore(
  question: Question,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts = 0,
) {
  if (question.type === "estimation") {
    if (typeof answer !== "number") return 0;
    const { proximity } = calculateEstimationMetrics(question, answer);
    const safeTime = Math.min(Math.max(timeUsed, 0), question.timeLimit);
    const speedMultiplier = 1 - 0.5 * (safeTime / question.timeLimit);
    return Math.max(0, Math.round(question.points * proximity * speedMultiplier));
  }

  if (question.type === "logic-code") {
    if (!isAnswerCorrect(question, answer)) return 0;
    const speedScore = calculateQuestionScore(question, true, timeUsed);
    return Math.max(0, speedScore - Math.round(question.points * 0.1) * incorrectAttempts);
  }

  if (question.type === "classification") {
    if (!isClassificationAnswer(answer)) return 0;
    const correctCount = question.items.filter(
      (item) => answer[item.label] === item.correctCategory,
    ).length;
    const safeTime = Math.min(Math.max(timeUsed, 0), question.timeLimit);
    const speedMultiplier = 1 - 0.5 * (safeTime / question.timeLimit);
    return Math.round(question.points * (correctCount / question.items.length) * speedMultiplier);
  }

  if (question.type === "matching") {
    if (!isMatchingAnswer(answer)) return 0;
    const { correctPairs, totalPairs } = calculateMatchingMetrics(question, answer);
    const safeTime = Math.min(Math.max(timeUsed, 0), question.timeLimit);
    const speedMultiplier = 1 - 0.5 * (safeTime / question.timeLimit);
    return Math.round(question.points * (correctPairs / totalPairs) * speedMultiplier);
  }

  return calculateQuestionScore(question, isAnswerCorrect(question, answer), timeUsed);
}

export function evaluateAnswer({
  question,
  answer,
  timeUsed,
  timedOut = false,
  submittedCodes = [],
}: EvaluationInput): AnswerResult {
  const safeTime = Math.min(Math.max(timeUsed, 0), question.timeLimit);
  const isCorrect = answer !== null && isAnswerCorrect(question, answer);
  const matchingMetrics =
    question.type === "matching" && isMatchingAnswer(answer)
      ? calculateMatchingMetrics(question, answer)
      : undefined;
  const incorrectAttempts =
    question.type === "logic-code" ? Math.max(0, submittedCodes.length - (isCorrect ? 1 : 0)) : 0;
  const points =
    answer === null || (timedOut && question.type !== "matching")
      ? 0
      : calculateAnswerScore(question, answer, safeTime, incorrectAttempts);
  const status =
    answer === null || (timedOut && question.type === "matching" && !matchingMetrics?.correctPairs)
      ? "unanswered"
      : question.type === "estimation" && !isCorrect
        ? "partial"
        : question.type === "matching" && !isCorrect && Boolean(matchingMetrics?.correctPairs)
          ? "partial"
          : isCorrect
            ? "correct"
            : "incorrect";

  return {
    questionId: question.id,
    answer,
    status,
    isCorrect,
    points,
    timeUsed: safeTime,
    ...(question.type === "logic-code"
      ? { details: { type: "logic-code" as const, submittedCodes, incorrectAttempts } }
      : question.type === "estimation" && typeof answer === "number"
        ? {
            details: {
              type: "estimation" as const,
              ...calculateEstimationMetrics(question, answer),
            },
          }
        : question.type === "matching" && matchingMetrics
          ? { details: { type: "matching" as const, ...matchingMetrics } }
          : {}),
  };
}

export function calculateTotalScore(scores: number[]) {
  return Math.max(
    0,
    scores.reduce((total, score) => total + score, 0),
  );
}
