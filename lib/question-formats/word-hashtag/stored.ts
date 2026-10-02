import { isValidWordHashtagConfiguration } from "@/lib/wordHashtag";
import type {
  FlashEditorialQuestion,
  FlashEditorialWordHashtagQuestion,
} from "@/types/contracts/stored-questions";
import type { WordHashtagQuestion } from "@/types/gameplay";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  isRecord,
  storedEnvelope,
  wordHashtagSolutionKeys,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "word-hashtag" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato word-hashtag.`,
    ]);
  const publicPayload = publicResult.value;

  const initialLetters = publicPayload.initialLetters;
  const words = solutionPayload.words;

  const legacyQuestion = {
    id: value.slug as string,
    type: "word-hashtag" as const,
    category: typeof publicPayload.category === "string" ? publicPayload.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: publicPayload.question as string,
    grid: { rows: 5, columns: 5 } as const,
    initialLetters: initialLetters as Array<string | null>,
    maxMoves: publicPayload.maxMoves as number,
    words: words as WordHashtagQuestion["words"],
    timeLimit: (value.timeLimitMs as number) / 1000,
    points: value.points as number,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies WordHashtagQuestion;
  if (
    !hasOnlyKeys(solutionPayload, wordHashtagSolutionKeys) ||
    !isRecord(words) ||
    !isValidWordHashtagConfiguration(legacyQuestion)
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato word-hashtag.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "word-hashtag",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialWordHashtagQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialWordHashtagQuestion["solutionPayload"],
  };
}
