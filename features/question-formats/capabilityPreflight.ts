import { competitiveCapabilityFor } from "./capabilities";
import type { FlashEditorialDocument } from "@/types/view-models/editorial";

export type CapabilityPreflightCode = "unsupported_question_type" | "unsupported_schema_version";

export type CapabilityPreflightIssue = {
  readonly code: CapabilityPreflightCode;
  readonly questionIndex: number;
  readonly message: string;
};

function issue(
  code: CapabilityPreflightCode,
  questionIndex: number,
  message: string,
): CapabilityPreflightIssue {
  return { code, questionIndex, message };
}

/**
 * Checks the part of an editorial document whose type and payload are already
 * available locally. Library references are intentionally left to the final
 * server/database validation because their type and payload are resolved by
 * questionVersionId there.
 */
export function findEditorialCapabilityIssue(
  document: FlashEditorialDocument,
): CapabilityPreflightIssue | null {
  for (const [questionIndex, question] of document.questions.entries()) {
    if ("source" in question) continue;

    const capability = competitiveCapabilityFor(question.type, document.challenge.mode);
    if (!capability) {
      return issue(
        "unsupported_question_type",
        questionIndex,
        `questions[${questionIndex}] usa ${question.type}, que no está admitido en ${document.challenge.mode}.`,
      );
    }
    if (!capability.payloadSchemaVersions.includes(question.payloadSchemaVersion)) {
      return issue(
        "unsupported_schema_version",
        questionIndex,
        `questions[${questionIndex}] usa una versión de payload no soportada para ${question.type}.`,
      );
    }
  }
  return null;
}
