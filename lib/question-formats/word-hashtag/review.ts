import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import { isValidWordHashtagConfiguration } from "@/lib/wordHashtag";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType, WordHashtagQuestion } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "word-hashtag" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"word-hashtag"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  const words = solution.words;
  if (!words || typeof words !== "object" || Array.isArray(words)) {
    throw new ServerFlashQuestionError();
  }
  const fullQuestion = {
    id: question.id,
    type: "word-hashtag",
    category: question.category,
    tags: question.tags,
    question: question.question,
    grid: question.grid,
    initialLetters: [...question.initialLetters],
    maxMoves: question.maxMoves,
    words: words as WordHashtagQuestion["words"],
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  } satisfies WordHashtagQuestion;
  if (!isValidWordHashtagConfiguration(fullQuestion)) {
    throw new ServerFlashQuestionError();
  }
  return fullQuestion;
}
