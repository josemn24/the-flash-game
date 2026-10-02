import { isValidZipConfiguration } from "@/lib/zip";
import type {
  FlashEditorialQuestion,
  FlashEditorialZipQuestion,
} from "@/types/contracts/stored-questions";
import type { ZipQuestion } from "@/types/gameplay";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  storedEnvelope,
  zipSolutionKeys,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "zip" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato zip.`]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, zipSolutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato zip.`]);
  }
  const configuration = {
    grid: publicPayload.grid,
    checkpoints: publicPayload.checkpoints,
  };
  const solution = solutionPayload.solution;

  const legacyQuestion: ZipQuestion = {
    id: value.slug as string,
    type: "zip",
    category: typeof publicPayload.category === "string" ? publicPayload.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: publicPayload.question as string,
    grid: configuration.grid as { rows: 5; columns: 5 },
    checkpoints: configuration.checkpoints as ZipQuestion["checkpoints"],
    solution: solution as number[],
    timeLimit: (value.timeLimitMs as number) / 1000,
    points: value.points as number,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  };
  if (
    !Array.isArray(solution) ||
    solution.length !== 25 ||
    !solution.every((cell) => Number.isSafeInteger(cell)) ||
    !isValidZipConfiguration(legacyQuestion)
  ) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato zip.`]);
  }
  return {
    slug: value.slug as string,
    type: "zip",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialZipQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialZipQuestion["solutionPayload"],
  };
}
