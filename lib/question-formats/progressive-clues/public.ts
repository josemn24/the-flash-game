import { definition } from "./definition";

import type { ServerProgressiveCluesQuestion } from "@/types/gameplay/challenge";

import { scaleProgressiveCluePenalty } from "@/lib/scoringCore/questions/progressiveClues";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "progressive-clues" }> {
  const { value, base } = publicEnvelope(context, definition);
  const { progress, allowCompleteProgress = false, points } = context;
  const rawProgress =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : {};
  const rawClues = Array.isArray(rawProgress.clues)
    ? rawProgress.clues.filter((clue): clue is string => typeof clue === "string")
    : allowCompleteProgress && Array.isArray(value.clues)
      ? value.clues.filter((clue): clue is string => typeof clue === "string")
      : [];
  const totalClues =
    typeof value.clueCount === "number"
      ? value.clueCount
      : typeof rawProgress.totalClues === "number"
        ? rawProgress.totalClues
        : rawClues.length;
  const editorialCluePenalty =
    typeof value.cluePenalty === "number" ? value.cluePenalty : Number.NaN;
  const cluePenalty =
    typeof rawProgress.cluePenalty === "number"
      ? rawProgress.cluePenalty
      : Number.isSafeInteger(editorialCluePenalty) && editorialCluePenalty >= 0
        ? scaleProgressiveCluePenalty(editorialCluePenalty, 100, points)
        : Number.NaN;
  const revealedClues =
    typeof rawProgress.revealedClues === "number" ? rawProgress.revealedClues : rawClues.length;
  const availablePoints =
    typeof rawProgress.availablePoints === "number" ? rawProgress.availablePoints : points;
  if (
    !Number.isSafeInteger(totalClues) ||
    totalClues < 1 ||
    totalClues > 20 ||
    !Number.isSafeInteger(cluePenalty) ||
    cluePenalty < 0 ||
    !Number.isSafeInteger(revealedClues) ||
    revealedClues < 1 ||
    revealedClues > totalClues ||
    rawClues.length !== revealedClues ||
    !rawClues.every((clue) => clue.trim().length > 0) ||
    !Number.isSafeInteger(availablePoints) ||
    availablePoints < 0
  ) {
    throw new ServerFlashQuestionError();
  }
  const progressiveProgress: ServerProgressiveCluesQuestion["progress"] = {
    kind: "progressive-clues",
    clues: rawClues,
    revealedClues,
    totalClues,
    availablePoints,
    cluePenalty,
  };
  return {
    ...base,
    type: "progressive-clues",
    clues: rawClues,
    totalClues,
    cluePenalty,
    progress: progressiveProgress,
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
