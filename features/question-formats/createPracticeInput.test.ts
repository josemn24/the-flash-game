import { describe, expect, it, vi } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "./catalog";
import { createPracticeInput } from "./createPracticeInput";
import { withPracticeTimedResponseStart } from "./withPracticeTimedResponseStart";
import { practiceInput, practiceInputFor, practiceInputSource } from "@/test-utils/practiceInput";
import type { AnswerValue } from "@/types/contracts";
import type { PracticeQuestionType } from "@/types/gameplay/practice";

const restorations = [
  ["classification", { planeta: "rocoso" }],
  ["connect-pairs", { paths: { a: [0, 1] } }],
  ["error-reconstruction", { stepId: "paso-1", correction: null }],
  ["matching", { a: "b" }],
  ["mini-wordle", { guesses: ["luna"] }],
  ["ordering", ["segundo", "primero"]],
  ["progressive-clues", "  borrador  "],
  ["queens", { queens: [0], marks: [1] }],
  ["word-hashtag", { swaps: [{ fromCell: 0, toCell: 1 }] }],
  ["word-search", { foundWordIds: ["a"] }],
  ["logic-code", "012"],
] satisfies Array<[PracticeQuestionType, AnswerValue]>;
const timedFormats = new Set([
  "flash-memory",
  "simon-sequence",
  "mini-wordle",
  "progressive-image",
]);

describe("createPracticeInput", () => {
  it("returns null before a question is available without calling any operation", () => {
    const onSubmit = vi.fn();
    expect(createPracticeInput(practiceInputSource({ onSubmit }))).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(Object.values(QUESTION_FORMAT_CATALOG))(
    "projects $id with its question and only local operations",
    (format) => {
      const question = format.examples[0].question;
      const source = practiceInputSource({ question, locked: true });
      const input = createPracticeInput(source);
      expect(input?.context).toBe("practice");
      expect(input?.format).toBe(format.id);
      expect(input?.props.question).toBe(question);
      expect(input?.props.locked).toBe(true);
      expect(source.question).toBe(question);
      if (!input) throw new Error("Missing input");
      for (const key of [
        "pendingAnswer",
        "submissionState",
        "submissionStatusVisible",
        "submissionError",
        "onRetrySubmission",
      ]) {
        expect(input.props).not.toHaveProperty(key);
      }
      for (const [key, value] of Object.entries(input.props)) {
        if (key.startsWith("on")) expect(value).toBe(Reflect.get(source, key));
      }
      expect("initialAnswer" in input.props).toBe(restorations.some(([id]) => id === format.id));
      expect("onTimedResponseStart" in input.props).toBe(timedFormats.has(format.id));
      expect("onIncorrectAttempt" in input.props).toBe(
        ["matching", "queens", "word-search"].includes(format.id),
      );
    },
  );

  it.each(restorations)(
    "preserves the exact %s draft reference and its current normalization boundary",
    (format, draft) => {
      const snapshot = structuredClone(draft);
      const input = practiceInputFor(format, { initialAnswer: draft });
      expect(input.props).toHaveProperty("initialAnswer", draft);
      expect("initialAnswer" in input.props && input.props.initialAnswer).toBe(draft);
      expect(draft).toEqual(snapshot);
    },
  );

  it.each(restorations.map(([format]) => ({ format })))(
    "drops invalid, null and absent $format drafts",
    ({ format }) => {
      for (const initialAnswer of [true, null, undefined]) {
        const input = practiceInputFor(format, { initialAnswer });
        expect(input.props).toHaveProperty("initialAnswer", undefined);
      }
    },
  );

  it("retains shape checks rather than accepting a different structured answer", () => {
    expect(
      practiceInputFor("matching", { initialAnswer: { stepId: "x" } }).props.initialAnswer,
    ).toBeUndefined();
    expect(
      practiceInputFor("classification", { initialAnswer: { stepId: "x" } }).props.initialAnswer,
    ).toBeUndefined();
    expect(
      practiceInputFor("ordering", { initialAnswer: { path: [1, 2] } }).props.initialAnswer,
    ).toBeUndefined();
    expect(
      practiceInputFor("mini-wordle", { initialAnswer: { path: [0] } }).props.initialAnswer,
    ).toBeUndefined();
    expect(
      practiceInputFor("connect-pairs", { initialAnswer: { path: [0] } }).props.initialAnswer,
    ).toBeUndefined();
    expect(
      practiceInputFor("queens", { initialAnswer: { queens: [999], marks: [] } }).props
        .initialAnswer,
    ).toBeUndefined();
    expect(
      practiceInputFor("queens", { initialAnswer: { queens: [0], marks: [0] } }).props
        .initialAnswer,
    ).toBeUndefined();
  });

  it("keeps estimation and heat-map state entirely inside their controls", () => {
    for (const format of ["estimation", "heat-map"] as const) {
      const input = practiceInputFor(format, { initialAnswer: 75 });
      expect(input.props).not.toHaveProperty("initialAnswer");
      expect(input.props).not.toHaveProperty("onProgress");
    }
  });

  it("preserves the boolean code result, attempt default and clue initial values", () => {
    const onCodeAttempt = vi.fn((code: string) => code === "012");
    const code = practiceInputFor("logic-code", { onCodeAttempt });
    expect(code.props.codeAttemptCount).toBe(0);
    expect(code.props.onCodeAttempt("000")).toBe(false);
    expect(code.props.onCodeAttempt("012")).toBe(true);
    expect(practiceInputFor("logic-code", { codeAttemptCount: 3 }).props.codeAttemptCount).toBe(3);
    expect(practiceInputFor("progressive-clues").props.progressiveCluesRevealed).toBeUndefined();
    expect(
      practiceInputFor("progressive-clues", { progressiveCluesRevealed: 2 }).props
        .progressiveCluesRevealed,
    ).toBe(2);
  });

  it("forwards real values unchanged through answer, progress, incorrect and reveal channels", () => {
    const onSubmit = vi.fn();
    const onProgress = vi.fn();
    const onIncorrectAttempt = vi.fn();
    const onProgressiveClueReveal = vi.fn();
    const source = { onSubmit, onProgress, onIncorrectAttempt, onProgressiveClueReveal };
    practiceInputFor("true-false", source).props.onSubmit(false);
    practiceInputFor("estimation", source).props.onSubmit(42);
    practiceInputFor("heat-map", source).props.onSubmit({ x: 0.2, y: 0.7 });
    const pairs = { paths: { a: [0, 1] } };
    practiceInputFor("connect-pairs", source).props.onProgress(pairs);
    practiceInputFor("matching", source).props.onIncorrectAttempt();
    practiceInputFor("progressive-clues", source).props.onProgressiveClueReveal(2);
    expect(onSubmit.mock.calls).toEqual([[false], [42], [{ x: 0.2, y: 0.7 }]]);
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(pairs);
    expect(onIncorrectAttempt).toHaveBeenCalledOnce();
    expect(onProgressiveClueReveal).toHaveBeenCalledExactlyOnceWith(2);
  });
});

describe("withPracticeTimedResponseStart", () => {
  it.each(Object.values(QUESTION_FORMAT_CATALOG))(
    "intercepts only preparation-capable formats: $id",
    (format) => {
      const original = vi.fn();
      const intercepted = vi.fn();
      const input = practiceInput(format.examples[0].question, { onTimedResponseStart: original });
      const next = withPracticeTimedResponseStart(input, intercepted);
      if ("onTimedResponseStart" in next.props) {
        next.props.onTimedResponseStart();
        expect(intercepted).toHaveBeenCalledOnce();
        expect(original).not.toHaveBeenCalled();
        expect(next.props.question).toBe(input.props.question);
        expect(next.context).toBe("practice");
      } else {
        expect(next).toBe(input);
        expect(intercepted).not.toHaveBeenCalled();
      }
      expect("onTimedResponseStart" in next.props).toBe(timedFormats.has(format.id));
    },
  );
});
