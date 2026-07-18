import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type { ProgressiveImageQuestion } from "@/types/game";

export const PROGRESSIVE_IMAGE_INITIAL_BLUR = 32;
export const PROGRESSIVE_IMAGE_INITIAL_SCALE = 1.08;

export function calculateProgressiveImageReveal(timeUsed: number, revealDuration: number): number {
  if (!Number.isFinite(timeUsed) || !Number.isFinite(revealDuration) || revealDuration <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, timeUsed / revealDuration));
}

export function isValidProgressiveImageConfiguration(question: ProgressiveImageQuestion): boolean {
  const acceptedAnswers = question.acceptedAnswers ?? [question.correctAnswer];
  const normalizedCorrectAnswer = normalizeAnswer(question.correctAnswer);
  const normalizedAnswers = acceptedAnswers.map(normalizeAnswer);

  return (
    question.surface.src.trim().length > 0 &&
    question.surface.alt.trim().length > 0 &&
    Number.isFinite(question.surface.width) &&
    question.surface.width > 0 &&
    Number.isFinite(question.surface.height) &&
    question.surface.height > 0 &&
    question.solutionAlt.trim().length > 0 &&
    Number.isFinite(question.revealDuration) &&
    question.revealDuration > 0 &&
    question.revealDuration < question.timeLimit &&
    normalizedCorrectAnswer.length > 0 &&
    normalizedAnswers.includes(normalizedCorrectAnswer) &&
    normalizedAnswers.every((answer) => answer.length > 0) &&
    new Set(normalizedAnswers).size === normalizedAnswers.length
  );
}
