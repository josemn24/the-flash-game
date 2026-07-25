import type { AnswerValue, FlashMemoryAnswer, FlashMemoryQuestion, Question } from "@/types/game";
import { calculateProportionalScore, calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): FlashMemoryQuestion {
  return question as FlashMemoryQuestion;
}

export function isFlashMemoryAnswer(answer: AnswerValue | null): answer is FlashMemoryAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    !("stepId" in answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

export function isValidFlashMemoryConfiguration(question: FlashMemoryQuestion) {
  const { rows, columns } = question.grid;
  const capacity = rows * columns;
  const itemIds = question.items.map((item) => item.id);
  const positions = question.items.map((item) => item.correctPosition);
  return (
    Number.isInteger(rows) &&
    Number.isInteger(columns) &&
    rows > 0 &&
    columns > 0 &&
    Number.isFinite(question.revealDuration) &&
    question.revealDuration > 0 &&
    question.items.length === capacity &&
    new Set(itemIds).size === itemIds.length &&
    new Set(positions).size === positions.length &&
    question.items.every(
      (item) =>
        Boolean(item.id.trim()) &&
        Boolean(item.label.trim()) &&
        Number.isInteger(item.correctPosition) &&
        item.correctPosition >= 0 &&
        item.correctPosition < capacity,
    )
  );
}

export function calculateFlashMemoryMetrics(
  question: FlashMemoryQuestion,
  answer: FlashMemoryAnswer,
) {
  const capacity = question.grid.rows * question.grid.columns;
  const validPositions = new Set(Array.from({ length: capacity }, (_, index) => String(index)));
  const itemIds = new Set(question.items.map((item) => item.id));
  const entries = Object.entries(answer);
  const assignedItemIds = entries.map(([, itemId]) => itemId);
  const valid =
    isValidFlashMemoryConfiguration(question) &&
    entries.length <= capacity &&
    entries.every(([position, itemId]) => validPositions.has(position) && itemIds.has(itemId)) &&
    new Set(assignedItemIds).size === assignedItemIds.length;
  const correctPlacements = valid
    ? question.items.filter((item) => answer[String(item.correctPosition)] === item.id).length
    : 0;
  return {
    correctPlacements,
    totalPlacements: capacity,
    complete: entries.length === capacity,
    valid,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (!isFlashMemoryAnswer(answer)) return false;
  const metrics = calculateFlashMemoryMetrics(asQuestion(question), answer);
  return metrics.valid && metrics.complete && metrics.correctPlacements === metrics.totalPlacements;
}

export function evaluateFlashMemory({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const flashQuestion = asQuestion(question);
  if (!isFlashMemoryAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateFlashMemoryMetrics(flashQuestion, answer);
  const correct = metrics.valid && metrics.correctPlacements === metrics.totalPlacements;
  return {
    isCorrect: correct,
    status: correct ? "correct" : metrics.correctPlacements > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      flashQuestion.points,
      metrics.correctPlacements,
      metrics.totalPlacements,
      calculateSpeedMultiplier(timeUsed, flashQuestion.timeLimit),
    ),
    details: {
      type: "flash-memory",
      correctPlacements: metrics.correctPlacements,
      totalPlacements: metrics.totalPlacements,
    },
  };
}

export const scoring = {
  questionType: "flash-memory",
  policy: "partial-items",
  preserveTimedOutPoints: true,
  isAnswer: isFlashMemoryAnswer,
  isCorrect,
  evaluate: evaluateFlashMemory,
} as const satisfies QuestionScoring;
