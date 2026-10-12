import { definition } from "./definition";

import type { ServerHeatMapQuestion } from "@/types/gameplay/challenge";

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
): Extract<ServerFlashQuestion, { type: "heat-map" }> {
  const { value, base } = publicEnvelope(context, definition);
  if (typeof value.targetLabel !== "string" || value.targetLabel.trim().length === 0) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "heat-map",
    surface: imageSurface(value),
    targetLabel: value.targetLabel,
  } satisfies ServerHeatMapQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
