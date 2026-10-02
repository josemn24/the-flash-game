import type { EscapeQuestion } from "@/types/gameplay/practice";
import { definition } from "./definition";

import type { ServerEscapeQuestion } from "@/types/gameplay/challenge";

import { isValidEscapePublicConfiguration } from "@/lib/escape";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "escape" }> {
  const { value, base } = publicEnvelope(context, definition);
  const configuration = {
    grid: value.grid,
    initialBlocks: value.initialBlocks,
  };
  if (
    !Object.keys(value).every((key) =>
      [
        "category",
        "tags",
        "question",
        "grid",
        "initialBlocks",
        "instruction",
        "hideInstruction",
        "objectiveLabel",
        "hideObjectiveLabel",
        "completionMessage",
        "boardLabel",
      ].includes(key),
    ) ||
    !isValidEscapePublicConfiguration(configuration as EscapeQuestion) ||
    (value.instruction !== undefined && typeof value.instruction !== "string") ||
    (value.hideInstruction !== undefined && typeof value.hideInstruction !== "boolean") ||
    (value.objectiveLabel !== undefined && typeof value.objectiveLabel !== "string") ||
    (value.hideObjectiveLabel !== undefined && typeof value.hideObjectiveLabel !== "boolean") ||
    (value.completionMessage !== undefined && typeof value.completionMessage !== "string") ||
    (value.boardLabel !== undefined && typeof value.boardLabel !== "string")
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "escape",
    grid: configuration.grid as ServerEscapeQuestion["grid"],
    initialBlocks: configuration.initialBlocks as ServerEscapeQuestion["initialBlocks"],
    instruction: typeof value.instruction === "string" ? value.instruction : null,
    hideInstruction: value.hideInstruction === true,
    objectiveLabel: typeof value.objectiveLabel === "string" ? value.objectiveLabel : null,
    hideObjectiveLabel: value.hideObjectiveLabel === true,
    completionMessage: typeof value.completionMessage === "string" ? value.completionMessage : null,
    boardLabel: typeof value.boardLabel === "string" ? value.boardLabel : null,
  } satisfies ServerEscapeQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
