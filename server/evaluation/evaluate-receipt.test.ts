import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { evaluateAnswer } from "@/lib/scoringCore/engine";
import type { DurationMs } from "@/types/domain/values";
import { evaluateReceipt } from "./evaluate-receipt";

const question = QUESTION_FORMAT_CATALOG["true-false"].examples[0].question;

describe("persisted receipt evaluation", () => {
  it("converts PostgreSQL milliseconds to evaluator seconds without adding processing time", () => {
    const input = { question, answer: question.correctAnswer };
    const receipt = { timeUsedMs: 1250 as DurationMs, timedOut: false };
    const expected = evaluateAnswer({ ...input, timeUsed: 1.25, timedOut: false });
    expect(evaluateReceipt({ ...input, receipt })).toEqual(expected);
    expect(evaluateReceipt({ ...input, receipt })).toEqual(expected);
  });

  it("uses the registered format timeout policy even when a late answer is correct", () => {
    const input = { question, answer: question.correctAnswer };
    expect(
      evaluateReceipt({ ...input, receipt: { timeUsedMs: 1000 as DurationMs, timedOut: true } }),
    ).toEqual(evaluateAnswer({ ...input, timeUsed: 1, timedOut: true }));
  });

  it.each([-1, NaN, Infinity, 0.5])("rejects invalid authoritative duration %s", (value) => {
    expect(() =>
      evaluateReceipt({
        question,
        answer: null,
        receipt: { timeUsedMs: value as DurationMs, timedOut: false },
      }),
    ).toThrow("Invalid authoritative receipt duration");
  });
});
