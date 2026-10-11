import { isValidQueensConfiguration } from "@/lib/queens";
import type { FlashEditorialQueensQuestion } from "@/types/contracts/stored-questions";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  storedEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { validateStoredPublic } from "./validation";

export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): FlashEditorialQueensQuestion {
  const { value, publicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(publicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (
    !publicResult.ok ||
    !hasOnlyKeys(solutionPayload, ["solution", "explanation"]) ||
    !Array.isArray(solutionPayload.solution) ||
    !isValidQueensConfiguration({
      ...publicResult.value,
      regions: [...publicResult.value.regions],
      prefilledQueens: [...publicResult.value.prefilledQueens],
      id: String(value.slug),
      type: "queens",
      category: "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      timeLimit: Number(value.timeLimitMs) / 1000,
      points: Number(value.points),
      explanation: "",
      solution: solutionPayload.solution,
    })
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] requiere un tablero Queens compatible y una solución válida.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "queens",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicResult.value as FlashEditorialQueensQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialQueensQuestion["solutionPayload"],
  };
}
