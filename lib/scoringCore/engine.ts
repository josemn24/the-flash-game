import type { AnswerResult, AnswerValue, Question } from "@/types/game";
import { SCORING } from "@/lib/scoringCore/registry";
import { clampTime } from "@/lib/scoringCore/shared";
import type { EvaluationInput } from "@/lib/scoringCore/types";

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
  return SCORING[question.type].evaluate({
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
  const scoring = SCORING[question.type];

  if (answer === null) {
    return {
      questionId: question.id,
      answer,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: safeTime,
      ...(scoring.unansweredDetails
        ? {
            details: scoring.unansweredDetails(question, {
              submittedCodes,
              revealedClues: progressiveCluesRevealed,
            }),
          }
        : {}),
    };
  }

  const isCorrect = isAnswerCorrect(question, answer);
  const incorrectAttempts =
    question.type === "logic-code" ? Math.max(0, submittedCodes.length - (isCorrect ? 1 : 0)) : 0;
  const evaluation = scoring.evaluate({
    question,
    answer,
    timeUsed: safeTime,
    submittedCodes,
    incorrectAttempts: question.type === "matching" ? matchingIncorrectAttempts : incorrectAttempts,
    revealedClues: question.type === "progressive-clues" ? progressiveCluesRevealed : 1,
  });
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
