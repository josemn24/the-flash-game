import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import type { FlashEditorialDocument } from "@/types/view-models/editorial";

export type CapabilityPreflightCode = "unsupported_question_type" | "unsupported_schema_version";

export type CapabilityPreflightIssue = {
  readonly code: CapabilityPreflightCode;
  readonly questionIndex: number;
  readonly message: string;
};

/**
 * Validates the locally available part of an editorial document. References
 * to the reusable question library remain for the authoritative RPC checks.
 */
export function findEditorialCapabilityIssue(
  document: FlashEditorialDocument,
): CapabilityPreflightIssue | null {
  for (const [questionIndex, question] of document.questions.entries()) {
    if ("source" in question) continue;

    const capability = competitiveCapabilityFor(question.type, document.challenge.mode);
    if (!capability) {
      return {
        code: "unsupported_question_type",
        questionIndex,
        message: `questions[${questionIndex}] usa ${question.type}, que no está admitido en ${document.challenge.mode}.`,
      };
    }
    if (!capability.payloadSchemaVersions.includes(question.payloadSchemaVersion)) {
      return {
        code: "unsupported_schema_version",
        questionIndex,
        message: `questions[${questionIndex}] usa una versión de payload no soportada para ${question.type}.`,
      };
    }
  }
  return null;
}
