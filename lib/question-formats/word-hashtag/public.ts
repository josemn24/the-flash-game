import { definition } from "./definition";

import type { ServerWordHashtagQuestion } from "@/types/gameplay/challenge";

import {
  isValidWordHashtagPublicConfiguration,
  WORD_HASHTAG_ACTIVE_CELLS,
} from "@/lib/wordHashtag";
import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "word-hashtag" }> {
  const { value, base } = publicEnvelope(context, definition);
  const { progress } = context;
  const configuration = {
    grid: value.grid,
    initialLetters: value.initialLetters,
    maxMoves: value.maxMoves,
  };
  if (
    !isValidWordHashtagPublicConfiguration(configuration as never) ||
    !Array.isArray(value.initialLetters) ||
    value.initialLetters.length !== 25 ||
    !value.initialLetters.every((letter) => letter === null || typeof letter === "string")
  ) {
    throw new ServerFlashQuestionError();
  }
  const rawProgress =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : {};
  const progressLetters = Array.isArray(rawProgress.letters)
    ? rawProgress.letters
    : value.initialLetters;
  const correctCells = Array.isArray(rawProgress.correctCells) ? rawProgress.correctCells : [];
  const swaps = Array.isArray(rawProgress.swaps)
    ? rawProgress.swaps.filter(
        (swap): swap is { fromCell: number; toCell: number } =>
          Boolean(swap) &&
          typeof swap === "object" &&
          Number.isSafeInteger((swap as Record<string, unknown>).fromCell) &&
          Number.isSafeInteger((swap as Record<string, unknown>).toCell),
      )
    : [];
  const safeProgress = {
    kind: "word-hashtag" as const,
    letters: progressLetters as Array<string | null>,
    correctCells: correctCells as number[],
    swaps,
    movesUsed: Number.isSafeInteger(rawProgress.movesUsed) ? Number(rawProgress.movesUsed) : 0,
    movesRemaining: Number.isSafeInteger(rawProgress.movesRemaining)
      ? Number(rawProgress.movesRemaining)
      : Number(value.maxMoves),
  } satisfies ServerWordHashtagQuestion["progress"];
  if (
    safeProgress.letters.length !== 25 ||
    !safeProgress.correctCells.every(
      (cell, index) =>
        Number.isSafeInteger(cell) &&
        cell >= 0 &&
        cell < 25 &&
        WORD_HASHTAG_ACTIVE_CELLS.includes(cell) &&
        safeProgress.letters[cell] !== null &&
        (index === 0 || safeProgress.correctCells[index - 1]! < cell),
    ) ||
    safeProgress.swaps.length !==
      (Array.isArray(rawProgress.swaps) ? rawProgress.swaps.length : 0) ||
    !safeProgress.letters.every((letter) => letter === null || typeof letter === "string") ||
    safeProgress.movesUsed < 0 ||
    safeProgress.movesUsed > Number(value.maxMoves) ||
    safeProgress.movesRemaining < 0 ||
    safeProgress.movesRemaining > Number(value.maxMoves)
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "word-hashtag",
    grid: { rows: 5, columns: 5 },
    initialLetters: value.initialLetters as Array<string | null>,
    maxMoves: value.maxMoves as number,
    progress: safeProgress,
  } satisfies ServerWordHashtagQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
