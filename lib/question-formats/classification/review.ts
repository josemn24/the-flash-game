import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "classification" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"classification"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    !solution.categoriesByItem ||
    typeof solution.categoriesByItem !== "object" ||
    Array.isArray(solution.categoriesByItem)
  ) {
    throw new ServerFlashQuestionError();
  }
  const categoriesByItem = solution.categoriesByItem as Record<string, unknown>;
  const labels = question.items.map((item) => item.label);
  if (
    Object.keys(categoriesByItem).length !== labels.length ||
    labels.some(
      (label) =>
        typeof categoriesByItem[label] !== "string" ||
        !question.categories.includes(categoriesByItem[label] as string),
    ) ||
    Object.keys(categoriesByItem).some((label) => !labels.includes(label))
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "classification",
    category: question.category,
    tags: question.tags,
    question: question.question,
    items: question.items.map((item) => ({
      label: item.label,
      correctCategory: categoriesByItem[item.label] as string,
    })),
    categories: [...question.categories],
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
