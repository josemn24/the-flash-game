import type { AnswerValue, ClassificationAnswer, Question } from "@/types/game";
import { normalizeAnswer } from "@/lib/normalizeAnswer";

export function isClassificationAnswer(answer: AnswerValue | null): answer is ClassificationAnswer {
  return answer !== null && typeof answer === "object" && !Array.isArray(answer);
}

export function isAnswerCorrect(question: Question, answer: AnswerValue): boolean {
  if (question.type === "classification") {
    return (
      isClassificationAnswer(answer) &&
      question.items.every((item) => answer[item.label] === item.correctCategory)
    );
  }

  if (question.type === "ordering") {
    return (
      Array.isArray(answer) &&
      answer.length === question.correctOrder.length &&
      answer.every((item, index) => item === question.correctOrder[index])
    );
  }

  if (question.type === "true-false") {
    return answer === question.correctAnswer;
  }

  if (typeof answer !== "string") return false;

  const accepted = question.type === "short-text"
    ? question.acceptedAnswers ?? [question.correctAnswer]
    : [question.correctAnswer];
  const normalizedAnswer = normalizeAnswer(answer);

  return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
}

export function calculateAnswerScore(
  question: Question,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts = 0,
): number {
  if (question.type === "logic-code") {
    if (!isAnswerCorrect(question, answer)) return 0;
    const speedScore = calculateQuestionScore(question, true, timeUsed);
    const attemptPenalty = Math.round(question.points * 0.1) * incorrectAttempts;
    return Math.max(0, speedScore - attemptPenalty);
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

  return calculateQuestionScore(question, isAnswerCorrect(question, answer), timeUsed);
}

export function calculateQuestionScore(
  question: Question,
  correct: boolean,
  timeUsed: number,
): number {
  if (correct) {
    const safeTime = Math.min(Math.max(timeUsed, 0), question.timeLimit);
    const score = Math.round(question.points * (1 - 0.5 * (safeTime / question.timeLimit)));
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
  return Math.max(
    0,
    scores.reduce((total, score) => total + score, 0),
  );
}
