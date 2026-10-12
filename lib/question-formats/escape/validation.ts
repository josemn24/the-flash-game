import { isValidEscapePublicConfiguration } from "@/lib/escape";
import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import type { EscapeQuestion } from "@/types/gameplay";
import {
  escapePublicPayloadKeys,
  hasOnlyKeys,
  nonEmptyString,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";
export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const configuration = {
      grid: publicPayload.grid,
      initialBlocks: publicPayload.initialBlocks,
    };
    const validPresentation = [
      "instruction",
      "objectiveLabel",
      "completionMessage",
      "boardLabel",
    ].every((key) => publicPayload[key] === undefined || nonEmptyString(publicPayload[key], 500));
    const validVisibility = ["hideInstruction", "hideObjectiveLabel"].every(
      (key) => publicPayload[key] === undefined || typeof publicPayload[key] === "boolean",
    );
    if (!hasOnlyKeys(publicPayload, escapePublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (context.payloadSchemaVersion !== 1)
      throw new FormatValidationError("invalid_question_payload");
    if (!isValidEscapePublicConfiguration(configuration as EscapeQuestion))
      throw new FormatValidationError("invalid_question_payload");
    if (!validPresentation) throw new FormatValidationError("invalid_question_payload");
    if (!validVisibility) throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["escape"]["publicPayload"];
  });
}
