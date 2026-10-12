import { definition } from "./definition";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import {
  ServerFlashQuestionError,
  imageSurface,
  publicEnvelope,
  type PublicReadContext,
} from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "progressive-image" }> {
  const { value, base } = publicEnvelope(context, definition);
  const { timeLimitMs } = context;
  const revealDurationMs = value.revealDurationMs;
  if (
    typeof revealDurationMs !== "number" ||
    !Number.isSafeInteger(revealDurationMs) ||
    revealDurationMs <= 0 ||
    revealDurationMs >= timeLimitMs
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "progressive-image",
    surface: imageSurface(value),
    revealDuration: revealDurationMs / 1000,
    answerLabel: typeof value.answerLabel === "string" ? value.answerLabel : null,
    answerPlaceholder: typeof value.answerPlaceholder === "string" ? value.answerPlaceholder : null,
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
