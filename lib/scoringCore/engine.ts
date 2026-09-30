import type { AnswerResult, ResolvedAnswerValue, ResolvedQuestion } from "@/types/gameplay/scoring";
import { SCORING } from "@/lib/scoringCore/registry";
import { clampTime, normalizeScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  EvaluationInput,
  NormalizedEvaluationInput,
  NormalizedUnansweredInput,
  UnansweredDetailsContext,
} from "@/lib/scoringCore/types";

function buildDefaultEvaluationContext(input: NormalizedEvaluationInput): EvaluationContext {
  return {
    question: input.question,
    answer: input.answer,
    timeUsed: input.timeUsed,
    submittedCodes: input.submittedCodes,
    incorrectAttempts: input.incorrectAttempts,
    revealedClues: 1,
    availablePoints: input.progressiveClueAvailablePoints,
  };
}

function buildDefaultUnansweredDetailsContext(
  input: NormalizedUnansweredInput,
): UnansweredDetailsContext {
  return {
    submittedCodes: input.submittedCodes,
    incorrectAttempts: input.incorrectAttempts,
    revealedClues: input.progressiveCluesRevealed,
    availablePoints: input.progressiveClueAvailablePoints,
  };
}

export function isResolvedAnswerCorrect(
  question: ResolvedQuestion,
  answer: ResolvedAnswerValue,
): boolean {
  return SCORING[question.type].isCorrect(question, answer);
}

export function calculateResolvedAnswerScore(
  question: ResolvedQuestion,
  answer: ResolvedAnswerValue,
  timeUsed: number,
  incorrectAttempts = 0,
  revealedClues = 1,
) {
  const scoring = SCORING[question.type];
  if (!scoring.isAnswer(answer)) return 0;
  const safeTime = clampTime(timeUsed, question.timeLimit);
  const isCorrect = scoring.isCorrect(question, answer);

  const context = scoring.buildEvaluationContext?.({
    question,
    answer,
    timeUsed: safeTime,
    timedOut: false,
    submittedCodes: [],
    incorrectAttempts,
    matchingIncorrectAttempts: incorrectAttempts,
    progressiveCluesRevealed: revealedClues,
    isCorrect,
  }) ?? {
    question,
    answer,
    timeUsed: safeTime,
    submittedCodes: [],
    incorrectAttempts,
    revealedClues,
  };

  return normalizeScore(scoring.evaluate(context).points);
}

/**
 * Shared scoring kernel for a fully resolved private question.
 *
 * Adapters at the practice and competitive boundaries are responsible for
 * deciding where that private projection came from. This function must not be
 * used directly by browser-facing code.
 */
export function evaluateResolvedAnswer({
  question,
  answer,
  timeUsed,
  timedOut = false,
  submittedCodes = [],
  incorrectAttempts = 0,
  matchingIncorrectAttempts = 0,
  progressiveCluesRevealed = 1,
  progressiveClueAvailablePoints,
}: EvaluationInput): AnswerResult {
  const safeTime = clampTime(timeUsed, question.timeLimit);
  const scoring = SCORING[question.type];

  if (answer === null) {
    const unansweredInput: NormalizedUnansweredInput = {
      question,
      answer,
      timeUsed: safeTime,
      timedOut,
      submittedCodes,
      incorrectAttempts,
      matchingIncorrectAttempts,
      progressiveCluesRevealed,
      progressiveClueAvailablePoints,
    };
    return {
      questionId: question.id,
      answer,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: safeTime,
      ...(scoring.timeoutPolicy?.unansweredDetails
        ? {
            details: scoring.timeoutPolicy.unansweredDetails(
              question,
              scoring.timeoutPolicy.buildUnansweredDetailsContext?.(unansweredInput) ??
                buildDefaultUnansweredDetailsContext(unansweredInput),
            ),
          }
        : {}),
    };
  }

  if (!scoring.isAnswer(answer)) {
    return {
      questionId: question.id,
      answer,
      status: "incorrect",
      isCorrect: false,
      points: 0,
      timeUsed: safeTime,
    };
  }

  const isCorrect = isResolvedAnswerCorrect(question, answer);
  const normalizedInput: NormalizedEvaluationInput = {
    question,
    answer,
    timeUsed: safeTime,
    timedOut,
    submittedCodes,
    incorrectAttempts,
    matchingIncorrectAttempts,
    progressiveCluesRevealed,
    progressiveClueAvailablePoints,
    isCorrect,
  };
  const evaluation = scoring.evaluate(
    scoring.buildEvaluationContext?.(normalizedInput) ??
      buildDefaultEvaluationContext(normalizedInput),
  );
  const timedOutStatus = timedOut
    ? scoring.timeoutPolicy?.status?.(evaluation, question)
    : undefined;

  return {
    questionId: question.id,
    answer,
    ...evaluation,
    status: timedOutStatus ?? evaluation.status,
    points:
      timedOut && !scoring.timeoutPolicy?.preservePoints ? 0 : normalizeScore(evaluation.points),
    timeUsed: safeTime,
  };
}

export function calculateTotalScore(scores: number[]) {
  return Math.max(
    0,
    scores.reduce((total, score) => total + score, 0),
  );
}

export function getResolvedTimedOutAnswer(
  question: ResolvedQuestion,
  {
    draftAnswer,
    submittedCodes,
  }: {
    draftAnswer: ResolvedAnswerValue | null;
    submittedCodes: string[];
  },
): ResolvedAnswerValue | null {
  const source = SCORING[question.type].timeoutPolicy?.answerSource ?? "none";
  if (source === "draft") return draftAnswer;
  if (source === "last-submitted-code") return submittedCodes.at(-1) ?? null;
  return null;
}
