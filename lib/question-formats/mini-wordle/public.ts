import { definition } from "./definition";

import type { MiniWordleLetterFeedback } from "@/lib/miniWordle";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "mini-wordle" }> {
  const { value, base } = publicEnvelope(context, definition);
  const { progress } = context;
  const wordLength = value.wordLength;
  const maxAttempts = value.maxAttempts;
  if ((wordLength !== 4 && wordLength !== 5) || typeof maxAttempts !== "number") {
    throw new ServerFlashQuestionError();
  }
  const rawProgress =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : {};
  const guesses = Array.isArray(rawProgress.guesses)
    ? rawProgress.guesses.filter((guess): guess is string => typeof guess === "string")
    : [];
  const feedback = Array.isArray(rawProgress.feedback)
    ? (rawProgress.feedback as MiniWordleLetterFeedback[][])
    : [];
  return {
    ...base,
    type: "mini-wordle",
    hint: typeof value.hint === "string" ? value.hint : null,
    wordLength,
    maxAttempts,
    progress: {
      kind: "mini-wordle",
      guesses,
      feedback,
      attemptsUsed:
        typeof rawProgress.attemptsUsed === "number" ? rawProgress.attemptsUsed : guesses.length,
      maxAttempts,
    },
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
