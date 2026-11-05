import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { createPracticeInput } from "@/features/question-formats/createPracticeInput";
import type {
  PracticeInput,
  PracticeInputSource,
} from "@/features/question-formats/practiceInputTypes";
import type { PracticeQuestion, PracticeQuestionType } from "@/types/gameplay/practice";

const noop = () => undefined;
export function practiceInputSource(
  overrides: Partial<PracticeInputSource> = {},
): PracticeInputSource {
  return {
    question: null,
    locked: false,
    onSubmit: noop,
    onProgress: noop,
    onIncorrectAttempt: noop,
    onCodeAttempt: () => false,
    onProgressiveClueReveal: noop,
    onTimedResponseStart: noop,
    ...overrides,
  };
}

export function practiceInput(
  question: PracticeQuestion,
  overrides: Partial<PracticeInputSource> = {},
): PracticeInput {
  const input = createPracticeInput(practiceInputSource({ question, ...overrides }));
  if (!input) throw new Error("Expected a practice question");
  return input;
}

function hasFormat<T extends PracticeQuestionType>(
  input: PracticeInput,
  format: T,
): input is Extract<PracticeInput, { format: T }> {
  return input.format === format;
}
export function practiceInputFor<T extends PracticeQuestionType>(
  format: T,
  overrides: Partial<PracticeInputSource> = {},
) {
  const input = practiceInput(QUESTION_FORMAT_CATALOG[format].examples[0].question, overrides);
  if (!hasFormat(input, format)) throw new Error(`Unexpected practice input for ${format}`);
  return input;
}
