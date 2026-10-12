import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  hasOnlyKeys,
  isRecord,
  nonEmptyString,
  storedPublicEnvelope,
  wordSearchPublicPayloadKeys,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const grid = publicPayload.grid;
    const letters = publicPayload.letters;
    const targets = publicPayload.targets;
    const validGrid =
      isRecord(grid) &&
      hasOnlyKeys(grid, ["rows", "columns"]) &&
      Number.isSafeInteger(grid.rows) &&
      Number.isSafeInteger(grid.columns) &&
      (grid.rows as number) >= 6 &&
      (grid.rows as number) <= 10 &&
      (grid.columns as number) >= 6 &&
      (grid.columns as number) <= 10;
    const gridRows = validGrid ? (grid.rows as number) : 0;
    const gridColumns = validGrid ? (grid.columns as number) : 0;
    const validLetters =
      Array.isArray(letters) &&
      validGrid &&
      letters.length === gridRows * gridColumns &&
      letters.every(
        (letter) =>
          typeof letter === "string" &&
          Array.from(letter.normalize("NFC").trim().toLocaleUpperCase("es-ES")).length === 1 &&
          /^[A-ZÁÉÍÓÚÜÑ]$/u.test(letter.normalize("NFC").trim().toLocaleUpperCase("es-ES")),
      );
    const validTargets =
      Array.isArray(targets) &&
      targets.length >= 2 &&
      targets.length <= 8 &&
      targets.every(
        (target) =>
          isRecord(target) &&
          hasOnlyKeys(target, ["id", "word"]) &&
          nonEmptyString(target.id, 120) &&
          nonEmptyString(target.word, 120),
      );
    const targetIds = validTargets
      ? (targets as Array<Record<string, unknown>>).map((t) => t.id as string)
      : [];
    if (context.payloadSchemaVersion !== 1)
      throw new FormatValidationError("invalid_question_payload");
    if (!hasOnlyKeys(publicPayload, wordSearchPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validGrid) throw new FormatValidationError("invalid_question_payload");
    if (!validLetters) throw new FormatValidationError("invalid_question_payload");
    if (!validTargets) throw new FormatValidationError("invalid_question_payload");
    if (new Set(targetIds).size !== targetIds.length)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["word-search"]["publicPayload"];
  });
}
