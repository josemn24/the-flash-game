import { FORMAT_PUBLIC_VALIDATORS } from "@/lib/question-formats/publicRegistry";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type {
  CompetitiveInput,
  CompetitiveInputSource,
} from "@/features/question-formats/competitiveInputTypes";
import { createCompetitiveInput } from "@/features/question-formats/createCompetitiveInput";
import { corpus, runtimePayload } from "./format-contracts/context";

/** Public, validated corpus question; never exposes the private solution to a renderer. */
export function competitiveQuestion(format: CompetitiveQuestionType) {
  const test = corpus.find((test) => test.valid && test.document.type === format);
  if (!test) throw new Error(`Missing public fixture for ${format}`);
  const result = FORMAT_PUBLIC_VALIDATORS[format]({
    id: test.id,
    ...runtimePayload(test),
    timeLimitMs: test.document.timeLimitMs,
    points: 50,
    payloadSchemaVersion: test.document.payloadSchemaVersion,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

const noop = () => undefined;
export function competitiveInputSource(
  overrides: Partial<CompetitiveInputSource> = {},
): CompetitiveInputSource {
  return {
    question: null,
    locked: false,
    submissionState: "idle",
    submissionStatusVisible: false,
    submit: noop,
    updateDraft: noop,
    submitMiniWordleGuess: noop,
    submitLogicCodeAttempt: noop,
    queensState: "idle",
    queensStatusVisible: false,
    updateQueensDraft: noop,
    validateQueensBoard: noop,
    wordSearchState: "idle",
    wordSearchStatusVisible: false,
    submitWordSearchSelection: noop,
    submitWordHashtagSwap: noop,
    revealState: "idle",
    revealStatusVisible: false,
    revealProgressiveClue: noop,
    ...overrides,
  };
}

function hasFormat<T extends CompetitiveQuestionType>(
  input: CompetitiveInput | null,
  format: T,
): input is Extract<CompetitiveInput, { format: T }> {
  return input?.format === format;
}

export function competitiveInputFor<T extends CompetitiveQuestionType>(
  format: T,
  overrides: Partial<CompetitiveInputSource> = {},
) {
  const input = createCompetitiveInput(
    competitiveInputSource({ question: competitiveQuestion(format), ...overrides }),
  );
  if (!hasFormat(input, format)) throw new Error(`Unexpected input for ${format}`);
  return input;
}
