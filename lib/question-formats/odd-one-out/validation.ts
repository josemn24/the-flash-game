import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  ODD_ONE_OUT_MAX_ITEMS,
  ODD_ONE_OUT_MIN_ITEMS,
  hasOnlyKeys,
  isMedia,
  isRecord,
  nonEmptyString,
  oddOneOutPublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const items = publicPayload.items;
    const validItems =
      Array.isArray(items) &&
      items.length >= ODD_ONE_OUT_MIN_ITEMS &&
      items.length <= ODD_ONE_OUT_MAX_ITEMS &&
      items.every((item) => {
        if (!isRecord(item) || !hasOnlyKeys(item, ["id", "label", "media"])) return false;
        return (
          nonEmptyString(item.id, 120) && nonEmptyString(item.label, 500) && isMedia(item.media)
        );
      });
    const ids = validItems
      ? items.map((item) => (item as Record<string, unknown>).id as string)
      : [];
    if (!hasOnlyKeys(publicPayload, oddOneOutPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validItems) throw new FormatValidationError("invalid_question_payload");
    if (new Set(ids).size !== ids.length)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["odd-one-out"]["publicPayload"];
  });
}
