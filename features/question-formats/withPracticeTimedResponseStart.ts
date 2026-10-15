import type { PracticeInput } from "./practiceInputTypes";

/** Intercept only formats that signal the end of their preparation phase. */
export function withPracticeTimedResponseStart(
  input: PracticeInput,
  onTimedResponseStart: () => void,
): PracticeInput {
  switch (input.format) {
    case "flash-memory":
      return { ...input, props: { ...input.props, onTimedResponseStart } };
    case "simon-sequence":
      return { ...input, props: { ...input.props, onTimedResponseStart } };
    case "mini-wordle":
      return { ...input, props: { ...input.props, onTimedResponseStart } };
    case "progressive-image":
      return { ...input, props: { ...input.props, onTimedResponseStart } };
    default:
      return input;
  }
}
