import type {
  AnswerResultDetails,
  AnswerValue,
  ProgressiveCluesQuestion,
  Question,
} from "@/types/game";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): ProgressiveCluesQuestion {
  return question as ProgressiveCluesQuestion;
}

function clampRevealedClues(revealedClues: number, totalClues: number) {
  if (totalClues <= 0) return 0;
  const safeValue = Number.isFinite(revealedClues) ? Math.trunc(revealedClues) : 1;
  return Math.min(Math.max(safeValue, 1), totalClues);
}

export function scaleProgressiveCluePenalty(
  cluePenalty: number,
  sourcePoints: number,
  targetPoints: number,
) {
  if (sourcePoints <= 0 || targetPoints <= 0 || cluePenalty <= 0) return 0;
  return Math.max(1, Math.round((cluePenalty / sourcePoints) * targetPoints));
}

export function calculateProgressiveCluesMetrics(
  question: ProgressiveCluesQuestion,
  revealedClues: number,
  availablePointsOverride?: number,
) {
  const totalClues = question.clues.length;
  const safeRevealedClues = clampRevealedClues(revealedClues, totalClues);
  const additionalClues = Math.max(0, safeRevealedClues - 1);
  const calculatedPoints = Math.max(0, question.points - question.cluePenalty * additionalClues);
  const availablePoints =
    typeof availablePointsOverride === "number" && Number.isSafeInteger(availablePointsOverride)
      ? Math.min(Math.max(0, question.points), Math.max(0, availablePointsOverride))
      : calculatedPoints;
  return { revealedClues: safeRevealedClues, totalClues, availablePoints };
}

function isCorrect(question: Question, answer: AnswerValue) {
  const cluesQuestion = asQuestion(question);
  if (typeof answer !== "string") return false;
  const accepted = cluesQuestion.acceptedAnswers ?? [cluesQuestion.correctAnswer];
  const normalizedAnswer = normalizeAnswer(answer);
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
}

function unansweredDetails(
  question: Question,
  context: { revealedClues: number; availablePoints?: number },
): AnswerResultDetails {
  return {
    type: "progressive-clues",
    ...calculateProgressiveCluesMetrics(
      asQuestion(question),
      context.revealedClues,
      context.availablePoints,
    ),
  };
}

export function evaluateProgressiveClues({
  question,
  answer,
  timeUsed,
  revealedClues,
  availablePoints,
}: EvaluationContext): InternalEvaluation {
  const cluesQuestion = asQuestion(question);
  const correct = isCorrect(question, answer);
  const metrics = calculateProgressiveCluesMetrics(cluesQuestion, revealedClues, availablePoints);
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points: correct
      ? Math.round(
          metrics.availablePoints * calculateSpeedMultiplier(timeUsed, cluesQuestion.timeLimit),
        )
      : 0,
    details: { type: "progressive-clues", ...metrics },
  };
}

export const scoring = {
  questionType: "progressive-clues",
  policy: "clue-speed",
  timeoutPolicy: {
    unansweredDetails,
  },
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  buildEvaluationContext: (input) => ({
    question: input.question,
    answer: input.answer,
    timeUsed: input.timeUsed,
    submittedCodes: input.submittedCodes,
    incorrectAttempts: 0,
    revealedClues: input.progressiveCluesRevealed,
    availablePoints: input.progressiveClueAvailablePoints,
  }),
  evaluate: evaluateProgressiveClues,
} as const satisfies QuestionScoring;
