import corpus from "./corpus.json";
import type { EvaluationContext } from "@/application/ports/attempt-commands";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { JsonValue, DurationMs, UtcIsoDateTime } from "@/types/domain/values";
import type { QuestionVersionId, AnswerReceiptId } from "@/types/domain/identifiers";
import type { GameMode } from "@/types/domain/content";

export type ContractCase = (typeof corpus)[number];
export { corpus };
export function evaluationContext(test: ContractCase, mode: GameMode = "flash"): EvaluationContext {
  return {
    questionType: test.document.type as CompetitiveQuestionType,
    payloadSchemaVersion: test.document.payloadSchemaVersion,
    publicPayload: test.document.publicPayload as JsonValue,
    solutionPayload: test.document.solutionPayload as JsonValue,
    timeLimitMs: test.document.timeLimitMs as DurationMs,
    itemPoints: 50,
    itemConfigSchemaVersion: 1,
    modeConfigSchemaVersion: 1,
    itemConfig: {},
    modeConfig: {},
    mode,
    questionVersionId: "00000000-0000-4000-8000-000000000001" as QuestionVersionId,
    receiptId: "00000000-0000-4000-8000-000000000002" as AnswerReceiptId,
    answer: null,
    receivedAt: "2026-10-02T00:00:00Z" as UtcIsoDateTime,
    timeUsedMs: 1000 as DurationMs,
    timedOut: false,
  };
}
/** Simulates the authorized storage-to-public projection, including private image signing. */
export function runtimePayload(test: ContractCase): { payload: unknown; progress?: unknown } {
  const payload = structuredClone(test.document.publicPayload) as Record<string, unknown>;
  if (!payload || typeof payload !== "object") return { payload };
  for (const key of ["media", "surface"]) {
    const value = payload[key];
    if (value && typeof value === "object" && "assetId" in value) {
      const { assetId, ...surface } = value as Record<string, unknown>;
      payload[key] = { ...surface, src: `/authorized-assets/${assetId}.png` };
    }
  }
  if (test.document.type === "progressive-clues" && Array.isArray(payload.clues)) {
    const clues = payload.clues as string[];
    delete payload.clues;
    payload.clueCount = clues.length;
    return {
      payload,
      progress: {
        kind: "progressive-clues",
        clues: clues.slice(0, 1),
        revealedClues: 1,
        totalClues: clues.length,
      },
    };
  }
  return { payload };
}
