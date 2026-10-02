import { definition } from "./definition";

import type { ServerWordSearchQuestion } from "@/types/gameplay/challenge";

import { getWordSearchPath } from "@/lib/wordSearch";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "word-search" }> {
  const { value, base } = publicEnvelope(context, definition);
  const { progress } = context;
  const grid = value.grid;
  const letters = value.letters;
  const targets = value.targets;
  const rawProgress =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : {};
  const validGrid =
    grid &&
    typeof grid === "object" &&
    !Array.isArray(grid) &&
    Number.isSafeInteger((grid as Record<string, unknown>).rows) &&
    Number.isSafeInteger((grid as Record<string, unknown>).columns) &&
    Number((grid as Record<string, unknown>).rows) >= 6 &&
    Number((grid as Record<string, unknown>).rows) <= 10 &&
    Number((grid as Record<string, unknown>).columns) >= 6 &&
    Number((grid as Record<string, unknown>).columns) <= 10;
  const rows = validGrid ? Number((grid as Record<string, unknown>).rows) : 0;
  const columns = validGrid ? Number((grid as Record<string, unknown>).columns) : 0;
  const targetList = Array.isArray(targets) ? targets : [];
  const validLetters =
    Array.isArray(letters) &&
    letters.length === rows * columns &&
    letters.every((letter) => typeof letter === "string" && Array.from(letter).length === 1);
  const validTargets =
    targetList.length >= 2 &&
    targetList.length <= 8 &&
    targetList.every((target) => {
      if (!target || typeof target !== "object" || Array.isArray(target)) return false;
      const record = target as Record<string, unknown>;
      return (
        Object.keys(record).every((key) => ["id", "word"].includes(key)) &&
        typeof record.id === "string" &&
        record.id.trim().length > 0 &&
        typeof record.word === "string" &&
        record.word.trim().length > 0
      );
    });
  const targetIds = targetList.map((target) => (target as Record<string, unknown>).id as string);
  const rawSelections = Array.isArray(rawProgress.foundSelections)
    ? rawProgress.foundSelections
    : [];
  const foundSelections = rawSelections.filter(
    (
      selection,
    ): selection is {
      targetId: string;
      startCell: number;
      endCell: number;
    } => {
      if (!selection || typeof selection !== "object" || Array.isArray(selection)) return false;
      const record = selection as Record<string, unknown>;
      return (
        typeof record.targetId === "string" &&
        Number.isSafeInteger(record.startCell) &&
        Number.isSafeInteger(record.endCell)
      );
    },
  );
  const foundWordIds = Array.isArray(rawProgress.foundWordIds)
    ? rawProgress.foundWordIds.filter((id): id is string => typeof id === "string")
    : foundSelections.map((selection) => selection.targetId);
  const foundCount =
    typeof rawProgress.foundCount === "number" ? rawProgress.foundCount : foundSelections.length;
  const totalWords =
    typeof rawProgress.totalWords === "number" ? rawProgress.totalWords : targetList.length;
  const incorrectAttempts =
    typeof rawProgress.incorrectAttempts === "number" ? rawProgress.incorrectAttempts : 0;
  if (
    !validGrid ||
    !validLetters ||
    !validTargets ||
    new Set(targetIds).size !== targetIds.length ||
    foundSelections.length !== foundWordIds.length ||
    new Set(foundWordIds).size !== foundWordIds.length ||
    !foundWordIds.every((id) => targetIds.includes(id)) ||
    !foundSelections.every((selection) => {
      const path = getWordSearchPath(
        { rows, columns } as ServerWordSearchQuestion["grid"],
        selection.startCell,
        selection.endCell,
      );
      return targetIds.includes(selection.targetId) && Boolean(path);
    }) ||
    foundCount !== foundSelections.length ||
    totalWords !== targetList.length ||
    !Number.isSafeInteger(incorrectAttempts) ||
    incorrectAttempts < 0
  ) {
    throw new ServerFlashQuestionError();
  }
  const safeProgress: ServerWordSearchQuestion["progress"] = {
    kind: "word-search",
    foundSelections,
    foundWordIds,
    foundCount,
    totalWords,
    incorrectAttempts,
  };
  return {
    ...base,
    type: "word-search",
    grid: { rows, columns },
    letters,
    targets: targetList as ServerWordSearchQuestion["targets"],
    progress: safeProgress,
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
