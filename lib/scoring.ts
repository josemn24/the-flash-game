import type { AnswerValue, Question } from "@/types/game";
import { normalizeAnswer } from "@/lib/normalizeAnswer";

export function isAnswerCorrect(
  question: Question,
  answer: AnswerValue,
): boolean {
  if (question.type === "ordering") {
    return Array.isArray(answer) &&
      answer.length === question.correctOrder.length &&
      answer.every((item, index) => item === question.correctOrder[index]);
  }

  if (typeof question.correctAnswer === "boolean") {
    return answer === question.correctAnswer;
  }

  if (typeof answer !== "string") return false;

  const accepted = question.acceptedAnswers ?? [question.correctAnswer];
  const normalizedAnswer = normalizeAnswer(answer);

  return accepted.some(
    (candidate) => normalizeAnswer(candidate) === normalizedAnswer,
  );
}

export function calculateQuestionScore(
  question: Question,
  correct: boolean,
  timeUsed: number,
): number {
  if (correct) {
    const safeTime = Math.min(Math.max(timeUsed, 0), question.timeLimit);
    const score = Math.round(
      question.points * (1 - 0.5 * (safeTime / question.timeLimit)),
    );
    return Math.max(score, Math.ceil(question.points * 0.5));
  }

  if (question.type === "true-false") {
    return -Math.round(question.points * 0.4);
  }

  if (
    question.type === "multiple-choice" ||
    question.type === "image-choice" ||
    question.type === "ordering"
  ) {
    return -Math.round(question.points * 0.2);
  }

  return 0;
}

export function calculateTotalScore(scores: number[]): number {
  return Math.max(0, scores.reduce((total, score) => total + score, 0));
}
