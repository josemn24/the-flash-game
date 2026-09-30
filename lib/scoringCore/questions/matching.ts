import type { AnswerValue, MatchingAnswer, MatchingQuestion, Question } from "@/types/compat/game";
import { calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): MatchingQuestion {
  return question as MatchingQuestion;
}

export function isMatchingAnswer(answer: AnswerValue | null): answer is MatchingAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    !("stepId" in answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

export function calculateMatchingMetrics(question: MatchingQuestion, answer: MatchingAnswer) {
  const correctPairs = question.leftItems.filter(
    (item) => answer[item.id] === item.correctMatchId,
  ).length;
  return { correctPairs, totalPairs: question.leftItems.length };
}

function isCompleteMatchingAnswer(question: MatchingQuestion, answer: AnswerValue): answer is MatchingAnswer {
  if (!isMatchingAnswer(answer)) return false;
  const leftIds = question.leftItems.map((item) => item.id);
  const rightIds = new Set(question.rightItems.map((item) => item.id));
  const answerEntries = Object.entries(answer);
  return (
    leftIds.length > 0 &&
    answerEntries.length === leftIds.length &&
    leftIds.every((leftId) => Object.hasOwn(answer, leftId)) &&
    answerEntries.every(([, rightId]) => rightIds.has(rightId)) &&
    new Set(answerEntries.map(([, rightId]) => rightId)).size === answerEntries.length
  );
}

function isCorrect(question: Question, answer: AnswerValue) {
  const matchingQuestion = asQuestion(question);
  return (
    isCompleteMatchingAnswer(matchingQuestion, answer) &&
    calculateMatchingMetrics(matchingQuestion, answer).correctPairs ===
      matchingQuestion.leftItems.length
  );
}

export function evaluateMatching({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const matchingQuestion = asQuestion(question);
  const correct = isCorrect(question, answer);
  if (!isMatchingAnswer(answer)) {
    return { isCorrect: correct, status: "incorrect", points: 0 };
  }

  const metrics = calculateMatchingMetrics(matchingQuestion, answer);
  const points = correct
    ? Math.round(
        matchingQuestion.points * calculateSpeedMultiplier(timeUsed, matchingQuestion.timeLimit),
      )
    : 0;
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points,
    details: { type: "matching", ...metrics },
  };
}

export const scoring = {
  questionType: "matching",
  policy: "binary-speed",
  timeoutPolicy: {
    answerSource: "draft",
    preservePoints: false,
    status: () => "unanswered",
  },
  isAnswer: isMatchingAnswer,
  isCorrect,
  buildEvaluationContext: (input) => ({
    question: input.question,
    answer: input.answer,
    timeUsed: input.timeUsed,
    submittedCodes: input.submittedCodes,
    incorrectAttempts: input.matchingIncorrectAttempts,
    revealedClues: 1,
  }),
  evaluate: evaluateMatching,
} as const satisfies QuestionScoring;
