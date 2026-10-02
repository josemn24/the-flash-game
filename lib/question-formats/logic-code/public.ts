import { definition } from "./definition";

import type { ServerLogicCodeQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "logic-code" }> {
  const { value, base } = publicEnvelope(context, definition);
  const { progress } = context;
  const clues = value.clues;
  const codeLength = value.codeLength;
  if (
    !Array.isArray(clues) ||
    clues.length === 0 ||
    typeof codeLength !== "number" ||
    !Number.isSafeInteger(codeLength) ||
    codeLength < 1 ||
    codeLength > 12 ||
    !clues.every((clue) => {
      if (!clue || typeof clue !== "object" || Array.isArray(clue)) return false;
      const item = clue as Record<string, unknown>;
      return (
        typeof item.code === "string" &&
        typeof item.hint === "string" &&
        item.code.length === codeLength
      );
    })
  ) {
    throw new ServerFlashQuestionError();
  }
  const rawProgress =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : {};
  const submittedCodes = Array.isArray(rawProgress.submittedCodes)
    ? rawProgress.submittedCodes.filter((code): code is string => typeof code === "string")
    : [];
  return {
    ...base,
    type: "logic-code",
    clues: clues as ServerLogicCodeQuestion["clues"],
    codeLength,
    progress: {
      kind: "logic-code",
      submittedCodes,
      incorrectAttempts:
        typeof rawProgress.incorrectAttempts === "number"
          ? rawProgress.incorrectAttempts
          : submittedCodes.length,
    },
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
