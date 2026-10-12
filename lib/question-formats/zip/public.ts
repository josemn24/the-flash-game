import { definition } from "./definition";

import type { ServerZipQuestion } from "@/types/gameplay/challenge";

import { isValidZipPublicConfiguration } from "@/lib/zip";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "zip" }> {
  const { value, base } = publicEnvelope(context, definition);
  const configuration = { grid: value.grid, checkpoints: value.checkpoints };
  if (
    !isValidZipPublicConfiguration(configuration) ||
    (value.instruction !== undefined && typeof value.instruction !== "string") ||
    (value.mapNote !== undefined && typeof value.mapNote !== "string") ||
    (value.boardLabel !== undefined && typeof value.boardLabel !== "string")
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "zip",
    grid: configuration.grid,
    checkpoints: configuration.checkpoints,
    instruction: typeof value.instruction === "string" ? value.instruction : null,
    mapNote: typeof value.mapNote === "string" ? value.mapNote : null,
    boardLabel: typeof value.boardLabel === "string" ? value.boardLabel : null,
  } satisfies ServerZipQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
