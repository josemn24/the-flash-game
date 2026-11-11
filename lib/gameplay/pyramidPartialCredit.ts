import type { AnswerResultDetails } from "@/types/contracts/result-details";

export const PYRAMID_PARTIAL_CREDIT_KEYS = {
  "connect-pairs": "connectPairsTimeoutPartialCredit",
  "word-search": "wordSearchTimeoutPartialCredit",
  queens: "queensTimeoutPartialCredit",
  matching: "matchingPartialCredit",
  classification: "classificationPartialCredit",
  ordering: "orderingPartialCredit",
} as const;

export type PyramidPartialCreditFormat = keyof typeof PYRAMID_PARTIAL_CREDIT_KEYS;
export type PyramidPartialCreditKey =
  (typeof PYRAMID_PARTIAL_CREDIT_KEYS)[PyramidPartialCreditFormat];
export const PYRAMID_PARTIAL_CREDIT_FORMATS = Object.keys(
  PYRAMID_PARTIAL_CREDIT_KEYS,
) as PyramidPartialCreditFormat[];

export function isPyramidDraftFormat(
  format: string,
): format is "matching" | "classification" | "ordering" {
  return format === "matching" || format === "classification" || format === "ordering";
}

export function isPyramidDraftAnswer(
  value: unknown,
): value is import("@/types/contracts/game-session").PyramidDraftAnswer {
  if (Array.isArray(value))
    return value.length <= 8 && value.every((item) => typeof item === "string");
  return (
    !!value &&
    typeof value === "object" &&
    Object.keys(value).length <= 20 &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

export function pyramidPartialCreditEnabled(config: unknown, format: string): boolean {
  if (!Object.hasOwn(PYRAMID_PARTIAL_CREDIT_KEYS, format) || !config || typeof config !== "object")
    return false;
  const key = PYRAMID_PARTIAL_CREDIT_KEYS[format as PyramidPartialCreditFormat];
  return key in config && (config as Record<string, unknown>)[key] === true;
}

export function pyramidPartialCreditOptions(
  config: unknown,
): Partial<Record<PyramidPartialCreditKey, true>> {
  return Object.fromEntries(
    PYRAMID_PARTIAL_CREDIT_FORMATS.filter((format) =>
      pyramidPartialCreditEnabled(config, format),
    ).map((format) => [PYRAMID_PARTIAL_CREDIT_KEYS[format], true] as const),
  );
}

export function hasAccreditedPartialCredit(details: AnswerResultDetails | undefined): boolean {
  return (
    !!details &&
    (("timeoutPartialCredit" in details && details.timeoutPartialCredit === true) ||
      ("pyramidPartialCredit" in details &&
        (details.pyramidPartialCredit === "submission" ||
          details.pyramidPartialCredit === "timeout")))
  );
}

export function timeoutPartialPoints(weight: number, correct: number, total: number): number {
  return total > 0 ? Math.min(weight - 1, Math.floor((weight * correct) / total)) : 0;
}
