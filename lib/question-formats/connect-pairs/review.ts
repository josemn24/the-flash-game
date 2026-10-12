import { isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { ConnectPairsQuestion, PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "connect-pairs" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"connect-pairs"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  const paths = solution.paths;
  if (!paths || typeof paths !== "object" || Array.isArray(paths)) {
    throw new ServerFlashQuestionError();
  }
  const fullQuestion = {
    id: question.id,
    type: "connect-pairs",
    category: question.category,
    tags: question.tags,
    question: question.question,
    grid: question.grid,
    pairs: [...question.pairs],
    solutionPaths: paths as ConnectPairsQuestion["solutionPaths"],
    requireFullCoverage: true,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  } satisfies ConnectPairsQuestion;
  if (!isValidConnectPairsConfiguration(fullQuestion)) throw new ServerFlashQuestionError();
  return fullQuestion;
}
