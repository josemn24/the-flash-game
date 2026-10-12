import { isNormalizedPoint, isValidHeatMapRadii } from "@/lib/heatMap";
import type {
  FlashEditorialHeatMapQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  heatMapSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "heat-map" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato heat-map.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, heatMapSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato heat-map.`,
    ]);
  }
  if (
    !isNormalizedPoint(solutionPayload.target) ||
    !isValidHeatMapRadii(solutionPayload.fullCreditRadius, solutionPayload.toleranceRadius)
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato heat-map.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "heat-map",
    payloadSchemaVersion: 2,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialHeatMapQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialHeatMapQuestion["solutionPayload"],
  };
}
