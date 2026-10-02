import { validatePrivateSolution } from "../private-common";
import { isPrivateImageSurface } from "../stored-common";
import { parseStored } from "./stored";

import { isNormalizedPoint, isValidHeatMapRadii } from "@/lib/heatMap";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { HeatMapQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"heat-map"> {
  const surface = publicPayload.surface;
  const validSurface =
    surface &&
    typeof surface === "object" &&
    !Array.isArray(surface) &&
    (typeof (surface as Record<string, unknown>).src === "string" ||
      (context.payloadSchemaVersion === 2 && isPrivateImageSurface(surface))) &&
    typeof (surface as Record<string, unknown>).alt === "string" &&
    Number.isSafeInteger((surface as Record<string, unknown>).width) &&
    Number((surface as Record<string, unknown>).width) > 0 &&
    Number((surface as Record<string, unknown>).width) <= 8192 &&
    Number.isSafeInteger((surface as Record<string, unknown>).height) &&
    Number((surface as Record<string, unknown>).height) > 0 &&
    Number((surface as Record<string, unknown>).height) <= 8192 &&
    ((surface as Record<string, unknown>).fit === undefined ||
      (surface as Record<string, unknown>).fit === "cover" ||
      (surface as Record<string, unknown>).fit === "contain") &&
    ((surface as Record<string, unknown>).position === undefined ||
      typeof (surface as Record<string, unknown>).position === "string");
  if (
    !Object.hasOwn(publicPayload, "surface") ||
    typeof publicPayload.targetLabel !== "string" ||
    publicPayload.targetLabel.trim().length === 0 ||
    !validSurface ||
    !isNormalizedPoint(solutionPayload.target) ||
    !isValidHeatMapRadii(solutionPayload.fullCreditRadius, solutionPayload.toleranceRadius)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "heat-map",
    surface: surface as HeatMapQuestion["surface"],
    targetLabel: publicPayload.targetLabel,
    target: solutionPayload.target,
    fullCreditRadius: solutionPayload.fullCreditRadius as number,
    toleranceRadius: solutionPayload.toleranceRadius as number,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  };
}

/** Validates the private payload against the validated stored public payload. */
export function validateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: unknown,
) {
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution, parseStored);
}
