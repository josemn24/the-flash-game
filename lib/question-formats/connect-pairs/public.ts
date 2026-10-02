import { definition } from "./definition";

import type { ServerConnectPairsQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "connect-pairs" }> {
  const { value, base } = publicEnvelope(context, definition);
  const grid = value.grid;
  const pairs = value.pairs;
  const validGrid =
    grid &&
    typeof grid === "object" &&
    !Array.isArray(grid) &&
    (grid as Record<string, unknown>).rows === 5 &&
    (grid as Record<string, unknown>).columns === 5;
  const validPairs =
    Array.isArray(pairs) &&
    pairs.length >= 3 &&
    pairs.length <= 5 &&
    pairs.every((pair) => {
      if (!pair || typeof pair !== "object" || Array.isArray(pair)) return false;
      const item = pair as Record<string, unknown>;
      const endpoints = item.endpoints;
      return (
        typeof item.id === "string" &&
        item.id.trim().length > 0 &&
        typeof item.label === "string" &&
        item.label.trim().length > 0 &&
        typeof item.symbol === "string" &&
        item.symbol.trim().length > 0 &&
        Array.isArray(endpoints) &&
        endpoints.length === 2 &&
        endpoints.every(
          (cell) => Number.isSafeInteger(cell) && Number(cell) >= 0 && Number(cell) < 25,
        ) &&
        endpoints[0] !== endpoints[1] &&
        (item.color === undefined || typeof item.color === "string")
      );
    });
  const pairIds = validPairs
    ? (pairs as Array<Record<string, unknown>>).map((pair) => pair.id)
    : [];
  const endpoints = validPairs
    ? (pairs as Array<Record<string, unknown>>).flatMap((pair) => pair.endpoints as number[])
    : [];
  if (
    !validGrid ||
    !validPairs ||
    new Set(pairIds).size !== pairIds.length ||
    new Set(endpoints).size !== endpoints.length ||
    value.requireFullCoverage !== true
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "connect-pairs",
    grid: { rows: 5, columns: 5 },
    pairs: pairs as ServerConnectPairsQuestion["pairs"],
    requireFullCoverage: true,
  } satisfies ServerConnectPairsQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
