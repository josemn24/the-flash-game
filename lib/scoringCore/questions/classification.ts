import type {
  AnswerValue,
  ClassificationAnswer,
  ClassificationQuestion,
  Question,
} from "@/types/game";
import { calculateProportionalScore, calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): ClassificationQuestion {
  return question as ClassificationQuestion;
}

export function isClassificationAnswer(answer: AnswerValue | null): answer is ClassificationAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    !("stepId" in answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

export function isValidClassificationAnswer(
  question: ClassificationQuestion,
  answer: AnswerValue | null,
): answer is ClassificationAnswer {
  if (!isClassificationAnswer(answer)) return false;
  const labels = new Set(question.items.map((item) => item.label));
  const categories = new Set(question.categories);
  return (
    Object.keys(answer).every((label) => labels.has(label)) &&
    Object.values(answer).every((category) => categories.has(category))
  );
}

function isCorrect(question: Question, answer: AnswerValue) {
  const classificationQuestion = asQuestion(question);
  return (
    isValidClassificationAnswer(classificationQuestion, answer) &&
    classificationQuestion.items.every((item) => answer[item.label] === item.correctCategory)
  );
}

export function evaluateClassification({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const classificationQuestion = asQuestion(question);
  const correct = isCorrect(question, answer);
  if (!isValidClassificationAnswer(classificationQuestion, answer)) {
    return { isCorrect: correct, status: "incorrect", points: 0 };
  }

  const correctItems = classificationQuestion.items.filter(
    (item) => answer[item.label] === item.correctCategory,
  ).length;
  return {
    isCorrect: correct,
    status: correct ? "correct" : correctItems > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      classificationQuestion.points,
      correctItems,
      classificationQuestion.items.length,
      calculateSpeedMultiplier(timeUsed, classificationQuestion.timeLimit),
    ),
  };
}

export const scoring = {
  questionType: "classification",
  policy: "partial-items",
  isAnswer: isClassificationAnswer,
  isCorrect,
  evaluate: evaluateClassification,
} as const satisfies QuestionScoring;
