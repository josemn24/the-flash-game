import { definition } from "./definition";

import type { ServerTrueFalseQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "true-false" }> {
  const { base } = publicEnvelope(context, definition);
  return { ...base, type: "true-false" } satisfies ServerTrueFalseQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
