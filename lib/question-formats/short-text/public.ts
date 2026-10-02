import { definition } from "./definition";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "short-text" }> {
  const { value, base } = publicEnvelope(context, definition);
  if (
    value.answerPlaceholder !== undefined &&
    value.answerPlaceholder !== null &&
    typeof value.answerPlaceholder !== "string"
  )
    throw new ServerFlashQuestionError();
  return {
    ...base,
    type: "short-text",
    answerPlaceholder: typeof value.answerPlaceholder === "string" ? value.answerPlaceholder : null,
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
