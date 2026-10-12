import { isValidMiniWordleWord, normalizeMiniWordleWord } from "@/lib/miniWordle";
import type {
  FlashEditorialMiniWordleQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  MINI_WORDLE_MAX_ADDITIONAL_GUESSES,
  miniWordleSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "mini-wordle" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato mini-wordle.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, miniWordleSolutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }
  const wordLength = publicPayload.wordLength;

  const correctAnswer = solutionPayload.correctAnswer;
  const additionalGuesses = solutionPayload.additionalGuesses;
  const dictionaryId = solutionPayload.dictionaryId;
  const normalizedSolution =
    typeof correctAnswer === "string" ? normalizeMiniWordleWord(correctAnswer) : "";
  const normalizedGuesses = Array.isArray(additionalGuesses)
    ? additionalGuesses.map((guess) =>
        typeof guess === "string" ? normalizeMiniWordleWord(guess) : "",
      )
    : [];
  if (
    (wordLength === 4 ? dictionaryId !== "es-general-4.v1" : dictionaryId !== "es-general-5.v1") ||
    typeof correctAnswer !== "string" ||
    !isValidMiniWordleWord(correctAnswer, wordLength) ||
    !Array.isArray(additionalGuesses) ||
    additionalGuesses.length > MINI_WORDLE_MAX_ADDITIONAL_GUESSES ||
    !additionalGuesses.every(
      (guess) => typeof guess === "string" && isValidMiniWordleWord(guess, wordLength),
    ) ||
    new Set(normalizedGuesses).size !== normalizedGuesses.length ||
    normalizedGuesses.includes(normalizedSolution)
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato Mini-Wordle.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "mini-wordle",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialMiniWordleQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialMiniWordleQuestion["solutionPayload"],
  };
}
