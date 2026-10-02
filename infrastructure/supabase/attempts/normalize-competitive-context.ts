import type { EvaluationContext } from "@/application/ports/attempt-commands";
import type { CompetitiveQuestionResolutionInput } from "@/application/ports/competitive-evaluator";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { FormatValidationError } from "@/lib/question-formats/types";
import { AttemptCommandError } from "./attemptCommandError";
export function normalizeCompetitiveEvaluationContext(
  context: EvaluationContext,
  publicRepresentation: "stored" | "authorized-runtime" = "stored",
): CompetitiveQuestionResolutionInput {
  try {
    return readStoredQuestion({ ...context, publicRepresentation });
  } catch (error) {
    if (error instanceof FormatValidationError) throw new AttemptCommandError(error.code);
    throw error;
  }
}
