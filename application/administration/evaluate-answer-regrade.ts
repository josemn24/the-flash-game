import type { EvaluationContext } from "@/application/ports/attempt-commands";
import type { CompetitiveEvaluator } from "@/application/ports/competitive-evaluator";

const supportedTypes = new Set(["short-text", "progressive-image", "progressive-clues"]);

export function evaluateWithPublishedAcceptedAnswers(
  evaluator: CompetitiveEvaluator,
  context: EvaluationContext,
  acceptedAnswers: readonly string[],
) {
  if (!supportedTypes.has(context.questionType)) throw new Error("invalid_command");
  if (context.timedOut || typeof context.answer !== "string" || !context.answer.trim()) {
    throw new Error("invalid_command");
  }
  if (!acceptedAnswers.length || acceptedAnswers.some((answer) => !answer.trim())) {
    throw new Error("invalid_command");
  }
  if (
    !context.solutionPayload ||
    typeof context.solutionPayload !== "object" ||
    Array.isArray(context.solutionPayload)
  ) {
    throw new Error("invalid_question_solution");
  }

  const result = evaluator.evaluate({
    ...context,
    solutionPayload: {
      ...context.solutionPayload,
      // The stored format validators require a canonical correctAnswer. It is
      // derived from this rubric list; scoring still uses the whole acceptedAnswers list.
      correctAnswer: acceptedAnswers[0],
      acceptedAnswers: [...acceptedAnswers],
    },
  });
  if (
    (result.status !== "correct" && result.status !== "partial" && result.status !== "incorrect") ||
    !Number.isSafeInteger(result.points) ||
    result.points < 0 ||
    result.points > context.itemPoints
  ) {
    throw new Error("invalid_score");
  }
  return { ...result, status: result.status };
}
