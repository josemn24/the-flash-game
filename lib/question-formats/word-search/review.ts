import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "word-search" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"word-search"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    !solution.positionsByTargetId ||
    typeof solution.positionsByTargetId !== "object" ||
    Array.isArray(solution.positionsByTargetId)
  ) {
    throw new ServerFlashQuestionError();
  }
  const positions = solution.positionsByTargetId as Record<string, unknown>;
  const targets = question.targets.map((target) => {
    const position = positions[target.id];
    if (!position || typeof position !== "object" || Array.isArray(position)) {
      throw new ServerFlashQuestionError();
    }
    const value = position as Record<string, unknown>;
    if (!Number.isSafeInteger(value.startCell) || !Number.isSafeInteger(value.endCell)) {
      throw new ServerFlashQuestionError();
    }
    return { ...target, startCell: value.startCell as number, endCell: value.endCell as number };
  });
  return {
    id: question.id,
    type: "word-search",
    category: question.category,
    tags: question.tags,
    question: question.question,
    grid: question.grid,
    letters: [...question.letters],
    targets,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
