import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_TYPES } from "./capabilities";
import { QUESTION_INPUT_RENDERERS } from "./QuestionInput";

describe("question renderer coverage", () => {
  it("registers every product QuestionType", () => {
    expect(Object.keys(QUESTION_INPUT_RENDERERS).sort()).toEqual([...QUESTION_FORMAT_TYPES].sort());
    for (const type of QUESTION_FORMAT_TYPES) {
      expect(QUESTION_INPUT_RENDERERS[type]).toBeTypeOf("function");
    }
  });
});
