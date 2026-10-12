import type {
  PublicQuestion,
  QuestionReveal,
  QuestionSolution,
  QuestionType,
} from "@/types/contracts/questions";
import type { ResolvedBaseQuestion } from "@/types/gameplay/scoring";
import type { FormatCapabilities } from "./metadata";
export type FormatDefinition<T extends QuestionType> = FormatCapabilities & { readonly id: T };
export type ValidationIssue = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
};
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };
export type StoredQuestionBase = Omit<ResolvedBaseQuestion, "explanation">;
export type StoredQuestionResolution = {
  publicQuestion: PublicQuestion;
  solution: QuestionSolution;
  points: number;
  reveals?: readonly QuestionReveal[];
};
export class FormatValidationError extends Error {
  constructor(
    readonly code:
      | "unsupported_question"
      | "invalid_question_payload"
      | "invalid_question_solution"
      | "invalid_question_config",
  ) {
    super(code);
  }
}
export function validationResult<T>(path: string, read: () => T): ValidationResult<T> {
  try {
    return { ok: true, value: read() };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return {
      ok: false,
      issues: [
        {
          code: error instanceof FormatValidationError ? error.code : "invalid_content",
          path,
          message: error.message,
        },
      ],
    };
  }
}
