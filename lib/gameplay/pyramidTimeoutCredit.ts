import type { AnswerResultDetails } from "@/types/contracts/result-details";

export const PYRAMID_TIMEOUT_CREDIT_KEYS = {
  "connect-pairs": "connectPairsTimeoutPartialCredit",
  "word-search": "wordSearchTimeoutPartialCredit",
  queens: "queensTimeoutPartialCredit",
} as const;

export type PyramidTimeoutCreditFormat = keyof typeof PYRAMID_TIMEOUT_CREDIT_KEYS;
export type PyramidTimeoutCreditKey =
  (typeof PYRAMID_TIMEOUT_CREDIT_KEYS)[PyramidTimeoutCreditFormat];
export const PYRAMID_TIMEOUT_CREDIT_FORMATS = Object.keys(
  PYRAMID_TIMEOUT_CREDIT_KEYS,
) as PyramidTimeoutCreditFormat[];

export function pyramidTimeoutCreditEnabled(config: unknown, format: string): boolean {
  if (!Object.hasOwn(PYRAMID_TIMEOUT_CREDIT_KEYS, format) || !config || typeof config !== "object")
    return false;
  const key = PYRAMID_TIMEOUT_CREDIT_KEYS[format as PyramidTimeoutCreditFormat];
  return key in config && (config as Record<string, unknown>)[key] === true;
}

export function pyramidTimeoutCreditOptions(
  config: unknown,
): Partial<Record<PyramidTimeoutCreditKey, true>> {
  return Object.fromEntries(
    PYRAMID_TIMEOUT_CREDIT_FORMATS.filter((format) =>
      pyramidTimeoutCreditEnabled(config, format),
    ).map((format) => [PYRAMID_TIMEOUT_CREDIT_KEYS[format], true] as const),
  );
}

export function hasTimeoutPartialCredit(details: AnswerResultDetails | undefined): boolean {
  return !!details && "timeoutPartialCredit" in details && details.timeoutPartialCredit === true;
}

export function timeoutPartialPoints(weight: number, correct: number, total: number): number {
  return total > 0 ? Math.min(weight - 1, Math.floor((weight * correct) / total)) : 0;
}
