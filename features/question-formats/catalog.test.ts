import { describe, expect, it } from "vitest";
import { stages } from "@/data/stages";
import { QUESTION_FORMAT_CATALOG, questionFormats } from "@/features/question-formats/catalog";

describe("question format catalog", () => {
  it("contains exactly seven formats with unique slugs", () => {
    expect(questionFormats).toHaveLength(7);
    expect(new Set(questionFormats.map((format) => format.slug)).size).toBe(7);
    expect(Object.keys(QUESTION_FORMAT_CATALOG)).toEqual([
      "multiple-choice",
      "true-false",
      "short-text",
      "ordering",
      "classification",
      "logic-code",
      "estimation",
    ]);
  });

  it("keeps both ten-question stages and models image choice as a variant", () => {
    expect(stages).toHaveLength(2);
    expect(stages.every((stage) => stage.questions.length === 10)).toBe(true);
    expect(
      stages
        .flatMap((stage) => stage.questions)
        .some(
          (question) =>
            question.type === "multiple-choice" && "media" in question && question.media,
        ),
    ).toBe(true);
    expect(
      stages
        .flatMap((stage) => stage.questions)
        .some((question) => (question.type as string) === "image-choice"),
    ).toBe(false);
  });
});
