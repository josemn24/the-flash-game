import "server-only";
import { evaluateAnswer } from "@/lib/scoringCore/engine";
import type { EvaluationInput } from "@/lib/scoringCore/types";
import type { DurationMs } from "@/types/domain/values";

/** Private input assembled from frozen content and the persisted receipt, never the request body. */
export type ReceiptEvaluationInput = Omit<EvaluationInput, "timeUsed" | "timedOut"> & {
  readonly receipt: { readonly timeUsedMs: DurationMs; readonly timedOut: boolean };
};

/** Reuse the 31-format registry, whose historical API measures duration in seconds. */
export function evaluateReceipt({ receipt, ...trustedInput }: ReceiptEvaluationInput) {
  if (!Number.isSafeInteger(receipt.timeUsedMs) || receipt.timeUsedMs < 0) {
    throw new Error("Invalid authoritative receipt duration");
  }
  return evaluateAnswer({
    ...trustedInput,
    timeUsed: receipt.timeUsedMs / 1000,
    timedOut: receipt.timedOut,
    submittedCodes: trustedInput.submittedCodes ?? [],
    incorrectAttempts: trustedInput.incorrectAttempts ?? 0,
  });
}
