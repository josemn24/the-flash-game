import { definition } from "./definition";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import {
  ServerFlashQuestionError,
  publicEnvelope,
  questionMedia,
  type PublicReadContext,
} from "../public-common";
import { validationResult } from "../types";
import { validateStoredPublic } from "./validation";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "multiple-choice" }> {
  const { value, base } = publicEnvelope(context, definition);
  const validated = validateStoredPublic(value, {
    payloadSchemaVersion: context.payloadSchemaVersion ?? 1,
    timeLimitMs: context.timeLimitMs,
    profile: "published",
    publicRepresentation: "authorized-runtime",
  });
  if (!validated.ok) throw new ServerFlashQuestionError();
  const media = questionMedia(validated.value);
  return {
    ...base,
    type: "multiple-choice",
    options: validated.value.options,
    ...(media ? { media } : {}),
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
