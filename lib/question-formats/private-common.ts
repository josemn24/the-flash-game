import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestion } from "@/types/gameplay/scoring";
import { capabilityForQuestionType, competitiveCapabilityFor } from "./definitions";
import type { StoredPublicContext } from "./stored-common";
import { FormatValidationError, validationResult, type StoredQuestionBase } from "./types";

type SolutionReader = (
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: Record<string, unknown>,
  base: StoredQuestionBase,
) => ResolvedQuestion;

/** Publication uses the strict editorial contract; older published versions use an explicit reader. */
export function validatePrivateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  input: unknown,
  reader: SolutionReader,
  parsePublication?: (
    input: unknown,
    index?: number,
    publicRepresentation?: StoredPublicContext["publicRepresentation"],
  ) => unknown,
) {
  return validationResult("solutionPayload", () => {
    const capability = competitiveCapabilityFor(context.questionType, context.mode);
    if (!capability?.payloadSchemaVersions.includes(context.payloadSchemaVersion))
      throw new FormatValidationError("unsupported_question");
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new FormatValidationError("invalid_question_solution");
    if (
      parsePublication &&
      capabilityForQuestionType(context.questionType).validation.payloadSchemaVersions.includes(
        context.payloadSchemaVersion,
      )
    ) {
      parsePublication(
        {
          slug: "solution-validation",
          type: context.questionType,
          payloadSchemaVersion: context.payloadSchemaVersion,
          timeLimitMs: context.timeLimitMs,
          points: 1,
          publicPayload,
          solutionPayload: input,
        },
        0,
        context.publicRepresentation,
      );
    }
    return reader(context, publicPayload, input as Record<string, unknown>, {
      id: context.receiptId,
      category: typeof publicPayload.category === "string" ? publicPayload.category : "",
      tags: (publicPayload.tags ?? {
        domains: [],
        topics: [],
        cognitiveSkills: [],
        formatSkills: [],
        lifeSkills: [],
      }) as ResolvedQuestion["tags"],
      question: String(publicPayload.question ?? publicPayload.prompt ?? ""),
      timeLimit: context.timeLimitMs / 1000,
      points: context.itemPoints,
    });
  });
}
