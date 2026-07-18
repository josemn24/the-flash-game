import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type {
  AnswerResult,
  AnswerResultDetails,
  AnswerStatus,
  AnswerValue,
  ClassificationAnswer,
  ClassificationQuestion,
  EstimationQuestion,
  LogicCodeQuestion,
  MatchingAnswer,
  MatchingQuestion,
  ProgressiveCluesQuestion,
  Question,
  QuestionType,
} from "@/types/game";

export type EvaluationInput = {
  question: Question;
  answer: AnswerValue | null;
  timeUsed: number;
  timedOut?: boolean;
  submittedCodes?: string[];
  matchingIncorrectAttempts?: number;
  progressiveCluesRevealed?: number;
};

export type ScoringPolicyId =
  "binary-speed" | "partial-items" | "attempt-penalty" | "proximity" | "clue-speed";

export const QUESTION_SCORING_POLICY = {
  "multiple-choice": "binary-speed",
  "odd-one-out": "binary-speed",
  matching: "partial-items",
  "true-false": "binary-speed",
  "short-text": "binary-speed",
  "progressive-clues": "clue-speed",
  ordering: "binary-speed",
  classification: "partial-items",
  "logic-code": "attempt-penalty",
  estimation: "proximity",
} as const satisfies Record<QuestionType, ScoringPolicyId>;

type InternalEvaluation = {
  isCorrect: boolean;
  status: AnswerStatus;
  points: number;
  details?: AnswerResultDetails;
};

type EvaluationContext = {
  question: Question;
  answer: AnswerValue;
  timeUsed: number;
  submittedCodes: string[];
  incorrectAttempts: number;
  revealedClues: number;
};

function isRecordAnswer(answer: AnswerValue | null): answer is Record<string, string> {
  return answer !== null && typeof answer === "object" && !Array.isArray(answer);
}

export function isClassificationAnswer(answer: AnswerValue | null): answer is ClassificationAnswer {
  return isRecordAnswer(answer);
}

export function isMatchingAnswer(answer: AnswerValue | null): answer is MatchingAnswer {
  return isRecordAnswer(answer);
}

function clampTime(timeUsed: number, timeLimit: number) {
  const safeLimit = Math.max(0, timeLimit);
  return Math.min(Math.max(timeUsed, 0), safeLimit);
}

function calculateSpeedMultiplier(timeUsed: number, timeLimit: number) {
  if (timeLimit <= 0) return 0.5;
  return 1 - 0.5 * (clampTime(timeUsed, timeLimit) / timeLimit);
}

function calculateProportionalScore(
  points: number,
  correctItems: number,
  totalItems: number,
  speedMultiplier: number,
) {
  if (totalItems <= 0) return 0;
  return Math.round(points * (correctItems / totalItems) * speedMultiplier);
}

function applyAttemptPenalty(score: number, points: number, incorrectAttempts: number) {
  const penalty = Math.round(points * 0.1) * Math.max(0, incorrectAttempts);
  return Math.max(0, score - penalty);
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
        question.type === "short-text" || question.type === "progressive-clues"
          ? (question.acceptedAnswers ?? [question.correctAnswer])
          : [question.correctAnswer];
      const normalizedAnswer = normalizeAnswer(answer);
      return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
    }
  }
}

function clampRevealedClues(revealedClues: number, totalClues: number) {
  if (totalClues <= 0) return 0;
  const safeValue = Number.isFinite(revealedClues) ? Math.trunc(revealedClues) : 1;
  return Math.min(Math.max(safeValue, 1), totalClues);
}

export function calculateProgressiveCluesMetrics(
  question: ProgressiveCluesQuestion,
  revealedClues: number,
) {
  const totalClues = question.clues.length;
  const safeRevealedClues = clampRevealedClues(revealedClues, totalClues);
  const additionalClues = Math.max(0, safeRevealedClues - 1);
  const availablePoints = Math.max(0, question.points - question.cluePenalty * additionalClues);
  return { revealedClues: safeRevealedClues, totalClues, availablePoints };
}

export function calculateEstimationMetrics(question: EstimationQuestion, answer: number) {
  const difference = Math.abs(answer - question.correctAnswer);
  const proximity =
    question.tolerance <= 0
      ? Number(difference === 0)
      : Math.min(1, Math.max(0, 1 - difference / question.tolerance));
  return { difference, proximity };
}

export function calculateQuestionScore(question: Question, correct: boolean, timeUsed: number) {
  if (correct) {
    const score = Math.round(
      question.points * calculateSpeedMultiplier(timeUsed, question.timeLimit),
    );
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

function evaluateBinarySpeed({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: calculateQuestionScore(question, isCorrect, timeUsed),
  };
}

function evaluateClassification(
  question: ClassificationQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (!isClassificationAnswer(answer)) {
    return { isCorrect, status: "incorrect", points: 0 };
  }

  const correctItems = question.items.filter(
    (item) => answer[item.label] === item.correctCategory,
  ).length;
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      correctItems,
      question.items.length,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
  };
}

function evaluateMatching(
  question: MatchingQuestion,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (!isMatchingAnswer(answer)) {
    return { isCorrect, status: "incorrect", points: 0 };
  }

  const metrics = calculateMatchingMetrics(question, answer);
  const partialScore = calculateProportionalScore(
    question.points,
    metrics.correctPairs,
    metrics.totalPairs,
    calculateSpeedMultiplier(timeUsed, question.timeLimit),
  );
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctPairs > 0 ? "partial" : "incorrect",
    points: applyAttemptPenalty(partialScore, question.points, incorrectAttempts),
    details: { type: "matching", ...metrics, incorrectAttempts },
  };
}

function evaluateEstimation(
  question: EstimationQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (typeof answer !== "number") {
    return { isCorrect, status: "partial", points: 0 };
  }

  const metrics = calculateEstimationMetrics(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "partial",
    points: Math.max(
      0,
      Math.round(
        question.points *
          metrics.proximity *
          calculateSpeedMultiplier(timeUsed, question.timeLimit),
      ),
    ),
    details: { type: "estimation", ...metrics },
  };
}

function evaluateLogicCode(
  question: LogicCodeQuestion,
  answer: AnswerValue,
  timeUsed: number,
  submittedCodes: string[],
  incorrectAttempts: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  const speedScore = isCorrect ? calculateQuestionScore(question, true, timeUsed) : 0;
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: applyAttemptPenalty(speedScore, question.points, incorrectAttempts),
    details: { type: "logic-code", submittedCodes, incorrectAttempts },
  };
}

function evaluateProgressiveClues(
  question: ProgressiveCluesQuestion,
  answer: AnswerValue,
  timeUsed: number,
  revealedClues: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  const metrics = calculateProgressiveCluesMetrics(question, revealedClues);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect
      ? Math.round(metrics.availablePoints * calculateSpeedMultiplier(timeUsed, question.timeLimit))
      : 0,
    details: { type: "progressive-clues", ...metrics },
  };
}

function evaluateByPolicy(context: EvaluationContext): InternalEvaluation {
  const { question, answer, timeUsed, submittedCodes, incorrectAttempts, revealedClues } = context;

  switch (QUESTION_SCORING_POLICY[question.type]) {
    case "binary-speed":
      return evaluateBinarySpeed(context);
    case "partial-items":
      if (question.type === "classification") {
        return evaluateClassification(question, answer, timeUsed);
      }
      if (question.type === "matching") {
        return evaluateMatching(question, answer, timeUsed, incorrectAttempts);
      }
      throw new Error(`Unsupported partial-items question: ${question.type}`);
    case "attempt-penalty": {
      if (question.type !== "logic-code") {
        throw new Error(`Unsupported attempt-penalty question: ${question.type}`);
      }
      return evaluateLogicCode(question, answer, timeUsed, submittedCodes, incorrectAttempts);
    }
    case "proximity": {
      if (question.type !== "estimation") {
        throw new Error(`Unsupported proximity question: ${question.type}`);
      }
      return evaluateEstimation(question, answer, timeUsed);
    }
    case "clue-speed": {
      if (question.type !== "progressive-clues") {
        throw new Error(`Unsupported clue-speed question: ${question.type}`);
      }
      return evaluateProgressiveClues(question, answer, timeUsed, revealedClues);
    }
  }
}

export function calculateAnswerScore(
  question: Question,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts = 0,
  revealedClues = 1,
) {
  return evaluateByPolicy({
    question,
    answer,
    timeUsed: clampTime(timeUsed, question.timeLimit),
    submittedCodes: [],
    incorrectAttempts,
    revealedClues,
  }).points;
}

export function evaluateAnswer({
  question,
  answer,
  timeUsed,
  timedOut = false,
  submittedCodes = [],
  matchingIncorrectAttempts = 0,
  progressiveCluesRevealed = 1,
}: EvaluationInput): AnswerResult {
  const safeTime = clampTime(timeUsed, question.timeLimit);
  if (answer === null) {
    return {
      questionId: question.id,
      answer,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: safeTime,
      ...(question.type === "logic-code"
        ? {
            details: {
              type: "logic-code" as const,
              submittedCodes,
              incorrectAttempts: submittedCodes.length,
            },
          }
        : question.type === "progressive-clues"
          ? {
              details: {
                type: "progressive-clues" as const,
                ...calculateProgressiveCluesMetrics(question, progressiveCluesRevealed),
              },
            }
          : {}),
    };
  }

  const isCorrect = isAnswerCorrect(question, answer);
  const incorrectAttempts =
    question.type === "logic-code" ? Math.max(0, submittedCodes.length - (isCorrect ? 1 : 0)) : 0;
  const evaluation = evaluateByPolicy({
    question,
    answer,
    timeUsed: safeTime,
    submittedCodes,
    incorrectAttempts: question.type === "matching" ? matchingIncorrectAttempts : incorrectAttempts,
    revealedClues: question.type === "progressive-clues" ? progressiveCluesRevealed : 1,
  });

  const matchingWithoutProgress =
    timedOut && evaluation.details?.type === "matching" && evaluation.details.correctPairs === 0;

  return {
    questionId: question.id,
    answer,
    ...evaluation,
    status: matchingWithoutProgress ? "unanswered" : evaluation.status,
    points: timedOut && question.type !== "matching" ? 0 : evaluation.points,
    timeUsed: safeTime,
  };
}

export function calculateTotalScore(scores: number[]) {
  return Math.max(
    0,
    scores.reduce((total, score) => total + score, 0),
  );
}
