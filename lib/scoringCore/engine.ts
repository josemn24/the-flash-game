import type { AnswerResult, AnswerValue, Question } from "@/types/game";
import { SCORING } from "@/lib/scoringCore/registry";
import { clampTime } from "@/lib/scoringCore/shared";
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
  };
}

function buildDefaultUnansweredDetailsContext(
  input: NormalizedUnansweredInput,
): UnansweredDetailsContext {
  return {
    submittedCodes: input.submittedCodes,
    revealedClues: input.progressiveCluesRevealed,
  };
}

export function isAnswerCorrect(question: Question, answer: AnswerValue): boolean {
  return SCORING[question.type].isCorrect(question, answer);
}

export function calculateAnswerScore(
  question: Question,
  answer: AnswerValue,
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

  return scoring.evaluate(context).points;
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
  const scoring = SCORING[question.type];

  if (answer === null) {
    const unansweredInput: NormalizedUnansweredInput = {
      question,
      answer,
      timeUsed: safeTime,
      timedOut,
      submittedCodes,
      matchingIncorrectAttempts,
      progressiveCluesRevealed,
    };
    return {
      questionId: question.id,
      answer,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: safeTime,
      ...(scoring.unansweredDetails
        ? {
            details: scoring.unansweredDetails(
              question,
              scoring.buildUnansweredDetailsContext?.(unansweredInput) ??
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

  const isCorrect = isAnswerCorrect(question, answer);
  const normalizedInput: NormalizedEvaluationInput = {
    question,
    answer,
    timeUsed: safeTime,
    timedOut,
    submittedCodes,
    incorrectAttempts: 0,
    matchingIncorrectAttempts,
    progressiveCluesRevealed,
    isCorrect,
  };
  const evaluation = scoring.evaluate(
    scoring.buildEvaluationContext?.(normalizedInput) ??
      buildDefaultEvaluationContext(normalizedInput),
  );
  const timedOutStatus = timedOut ? scoring.timedOutStatus?.(evaluation, question) : undefined;

  return {
    questionId: question.id,
    answer,
    ...evaluation,
    status: timedOutStatus ?? evaluation.status,
    points: timedOut && !scoring.preserveTimedOutPoints ? 0 : evaluation.points,
    timeUsed: safeTime,
  };
}

export function calculateTotalScore(scores: number[]) {
  return Math.max(
    0,
    scores.reduce((total, score) => total + score, 0),
  );
}

export function getTimedOutAnswer(
  question: Question,
  {
    draftAnswer,
    submittedCodes,
  }: {
    draftAnswer: AnswerValue | null;
    submittedCodes: string[];
  },
): AnswerValue | null {
  const source = SCORING[question.type].timeoutAnswerSource ?? "none";
  if (source === "draft") return draftAnswer;
  if (source === "last-submitted-code") return submittedCodes.at(-1) ?? null;
  return null;
}
