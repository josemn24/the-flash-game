import type { Question } from "@/types/game";

export const MIN_SPEED_MULTIPLIER = 0.6;
export const TRUE_FALSE_PENALTY_RATIO = 0.4;
export const CHOICE_PENALTY_RATIO = 0.2;
export const ATTEMPT_PENALTY_RATIO = 0.1;

export function clampTime(timeUsed: number, timeLimit: number) {
  const safeLimit = Math.max(0, timeLimit);
  return Math.min(Math.max(timeUsed, 0), safeLimit);
}

export function calculateSpeedMultiplier(timeUsed: number, timeLimit: number) {
  if (timeLimit <= 0) return MIN_SPEED_MULTIPLIER;
  return 1 - (1 - MIN_SPEED_MULTIPLIER) * (clampTime(timeUsed, timeLimit) / timeLimit);
}

export function calculateProportionalScore(
  points: number,
  correctItems: number,
  totalItems: number,
  speedMultiplier: number,
) {
  if (totalItems <= 0) return 0;
  return Math.round(points * (correctItems / totalItems) * speedMultiplier);
}

export function applyAttemptPenalty(score: number, points: number, incorrectAttempts: number) {
  const penalty = Math.round(points * ATTEMPT_PENALTY_RATIO) * Math.max(0, incorrectAttempts);
  return Math.max(0, score - penalty);
}

export function calculateQuestionScore(question: Question, correct: boolean, timeUsed: number) {
  if (correct) {
    const score = Math.round(
      question.points * calculateSpeedMultiplier(timeUsed, question.timeLimit),
    );
    return Math.max(score, Math.ceil(question.points * MIN_SPEED_MULTIPLIER));
  }

  if (question.type === "true-false")
    return -Math.round(question.points * TRUE_FALSE_PENALTY_RATIO);
  if (
    question.type === "multiple-choice" ||
    question.type === "odd-one-out" ||
    question.type === "ordering" ||
    question.type === "logic-matrix"
  ) {
    return -Math.round(question.points * CHOICE_PENALTY_RATIO);
  }
  return 0;
}
