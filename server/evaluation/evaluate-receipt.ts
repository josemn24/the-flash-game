import "server-only";
import { evaluateResolvedAnswer } from "@/lib/scoringCore/engine";
import type { EvaluationInput } from "@/lib/scoringCore/types";
import type { DurationMs } from "@/types/domain/values";

/**
 * Private input assembled from frozen public content, its server-only solution
 * and the persisted receipt. The browser never supplies this projection.
 */
export type CompetitiveReceiptEvaluationInput = Omit<
  EvaluationInput,
  "question" | "timeUsed" | "timedOut"
> & {
  readonly question: EvaluationInput["question"];
  readonly receipt: { readonly timeUsedMs: DurationMs; readonly timedOut: boolean };
};

/** @deprecated Use `CompetitiveReceiptEvaluationInput`. */
export type ReceiptEvaluationInput = CompetitiveReceiptEvaluationInput;

/** Reuse the 31-format registry, whose historical API measures duration in seconds. */
export function evaluateCompetitiveReceipt({
  receipt,
  ...trustedInput
}: CompetitiveReceiptEvaluationInput) {
  if (!Number.isSafeInteger(receipt.timeUsedMs) || receipt.timeUsedMs < 0) {
    throw new Error("Invalid authoritative receipt duration");
  }
  return evaluateResolvedAnswer({
    ...trustedInput,
    timeUsed: receipt.timeUsedMs / 1000,
    timedOut: receipt.timedOut,
    submittedCodes: trustedInput.submittedCodes ?? [],
    incorrectAttempts: trustedInput.incorrectAttempts ?? 0,
  });
}

/** @deprecated Use `evaluateCompetitiveReceipt`. */
export const evaluateReceipt = evaluateCompetitiveReceipt;
