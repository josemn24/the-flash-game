import { isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import type { FlashEditorialConnectPairsQuestion } from "@/types/contracts/stored-questions";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  storedEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { readPublic } from "./public";

export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): FlashEditorialConnectPairsQuestion {
  void publicRepresentation;
  const { value, publicPayload, solutionPayload } = storedEnvelope(input, index);
  try {
    if (
      !hasOnlyKeys(publicPayload, [
        "question",
        "category",
        "tags",
        "grid",
        "pairs",
        "requireFullCoverage",
      ]) ||
      !hasOnlyKeys(solutionPayload, ["paths", "explanation"])
    )
      throw new Error("invalid_content");
    const question = readPublic({
      id: String(value.slug),
      payload: publicPayload,
      timeLimitMs: Number(value.timeLimitMs),
      points: Number(value.points),
      payloadSchemaVersion: 1,
    });
    const paths = solutionPayload.paths;
    if (
      !paths ||
      typeof paths !== "object" ||
      Array.isArray(paths) ||
      !Object.values(paths).every((path) => Array.isArray(path) && path.every(Number.isSafeInteger))
    )
      throw new Error("invalid_content");
    if (
      !isValidConnectPairsConfiguration({
        ...question,
        pairs: [...question.pairs],
        solutionPaths: paths as Record<string, number[]>,
        explanation: "",
      })
    )
      throw new Error("invalid_content");
  } catch {
    throw new FlashEditorialValidationError([
      `questions[${index}] requiere un tablero Conectar parejas cuadrado de 4×4 a 8×8 y una solución válida.`,
    ]);
  }
  return {
    slug: String(value.slug),
    type: "connect-pairs",
    payloadSchemaVersion: 1,
    timeLimitMs: Number(value.timeLimitMs),
    points: Number(value.points),
    publicPayload: publicPayload as FlashEditorialConnectPairsQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialConnectPairsQuestion["solutionPayload"],
  };
}
