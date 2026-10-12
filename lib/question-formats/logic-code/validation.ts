import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  LOGIC_CODE_MAX_CLUES,
  LOGIC_CODE_MAX_LENGTH,
  hasOnlyKeys,
  isRecord,
  logicCodePublicPayloadKeys,
  nonEmptyString,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const clues = publicPayload.clues;
    const codeLength = publicPayload.codeLength;
    const validCodeLength =
      typeof codeLength === "number" &&
      Number.isSafeInteger(codeLength) &&
      codeLength >= 1 &&
      codeLength <= LOGIC_CODE_MAX_LENGTH;
    const validClues =
      Array.isArray(clues) &&
      clues.length > 0 &&
      clues.length <= LOGIC_CODE_MAX_CLUES &&
      clues.every((clue) => {
        if (!isRecord(clue) || !hasOnlyKeys(clue, ["code", "hint"])) return false;
        return (
          typeof clue.code === "string" &&
          typeof clue.hint === "string" &&
          nonEmptyString(clue.code, LOGIC_CODE_MAX_LENGTH) &&
          /^[0-9]+$/.test(clue.code) &&
          nonEmptyString(clue.hint, 500)
        );
      });
    if (!hasOnlyKeys(publicPayload, logicCodePublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validCodeLength) throw new FormatValidationError("invalid_question_payload");
    if (!validClues) throw new FormatValidationError("invalid_question_payload");
    if (!Array.isArray(clues)) throw new FormatValidationError("invalid_question_payload");
    if (
      !clues.every(
        (clue) =>
          isRecord(clue) && typeof clue.code === "string" && clue.code.length === codeLength,
      )
    )
      throw new FormatValidationError("invalid_question_payload");
    if (new Set(clues.filter(isRecord).map((clue) => clue.code)).size !== clues.length)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["logic-code"]["publicPayload"];
  });
}
