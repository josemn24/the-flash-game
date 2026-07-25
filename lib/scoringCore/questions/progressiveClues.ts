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

function isCorrect(question: Question, answer: AnswerValue) {
  const cluesQuestion = asQuestion(question);
  if (typeof answer !== "string") return false;
  const accepted = cluesQuestion.acceptedAnswers ?? [cluesQuestion.correctAnswer];
  const normalizedAnswer = normalizeAnswer(answer);
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
}

function unansweredDetails(
  question: Question,
  context: { revealedClues: number },
): AnswerResultDetails {
  return {
    type: "progressive-clues",
    ...calculateProgressiveCluesMetrics(asQuestion(question), context.revealedClues),
  };
}

export function evaluateProgressiveClues({
  question,
  answer,
  timeUsed,
  revealedClues,
}: EvaluationContext): InternalEvaluation {
  const cluesQuestion = asQuestion(question);
  const correct = isCorrect(question, answer);
  const metrics = calculateProgressiveCluesMetrics(cluesQuestion, revealedClues);
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
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  buildEvaluationContext: (input) => ({
    question: input.question,
    answer: input.answer,
    timeUsed: input.timeUsed,
    submittedCodes: input.submittedCodes,
    incorrectAttempts: 0,
    revealedClues: input.progressiveCluesRevealed,
  }),
  evaluate: evaluateProgressiveClues,
  unansweredDetails,
} as const satisfies QuestionScoring;
