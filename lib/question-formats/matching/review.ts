import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "matching" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"matching"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    !solution.matches ||
    typeof solution.matches !== "object" ||
    Array.isArray(solution.matches)
  ) {
    throw new ServerFlashQuestionError();
  }
  const matches = solution.matches as Record<string, unknown>;
  const leftItems = question.leftItems.map((item) => {
    const rightId = matches[item.id];
    if (typeof rightId !== "string") throw new ServerFlashQuestionError();
    return { ...item, correctMatchId: rightId };
  });
  if (
    Object.keys(matches).length !== leftItems.length ||
    new Set(leftItems.map((item) => item.correctMatchId)).size !== leftItems.length ||
    !leftItems.every((item) =>
      question.rightItems.some((right) => right.id === item.correctMatchId),
    )
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "matching",
    category: question.category,
    tags: question.tags,
    question: question.question,
    leftItems,
    rightItems: [...question.rightItems],
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
