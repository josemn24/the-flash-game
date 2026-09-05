import { describe, expect, it } from "vitest";
import { QUESTION_INPUT_RENDERERS } from "./QuestionInput";

const questionTypes = [
  "multiple-choice",
  "odd-one-out",
  "matching",
  "connect-pairs",
  "true-false",
  "short-text",
  "progressive-clues",
  "progressive-image",
  "heat-map",
  "image-labeling",
  "ordering",
  "classification",
  "flash-memory",
  "memory-pairs",
  "simon-sequence",
  "logic-matrix",
  "mini-sudoku",
  "mini-nonogram",
  "queens",
  "time-maze",
  "sliding-puzzle",
  "escape",
  "error-reconstruction",
  "anagram",
  "word-hashtag",
  "word-search",
  "mini-wordle",
  "logic-code",
  "estimation",
  "zip",
  "pipes",
] as const;

describe("question renderer coverage", () => {
  it("registers every product QuestionType", () => {
    expect(Object.keys(QUESTION_INPUT_RENDERERS).sort()).toEqual([...questionTypes].sort());
    for (const type of questionTypes) expect(QUESTION_INPUT_RENDERERS[type]).toBeTypeOf("function");
  });
});
