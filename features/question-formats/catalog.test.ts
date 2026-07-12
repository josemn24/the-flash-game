import { describe, expect, it } from "vitest";
import { stages } from "@/data/stages";
import { QUESTION_FORMAT_CATALOG, questionFormats } from "@/features/question-formats/catalog";

describe("question format catalog", () => {
  it("contains exactly eight formats with unique slugs", () => {
    expect(questionFormats).toHaveLength(8);
    expect(new Set(questionFormats.map((format) => format.slug)).size).toBe(8);
    expect(Object.keys(QUESTION_FORMAT_CATALOG)).toEqual([
      "multiple-choice",
      "odd-one-out",
      "true-false",
      "short-text",
      "ordering",
      "classification",
      "logic-code",
      "estimation",
    ]);
  });

  it("keeps the odd-one-out example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["odd-one-out"].example;
    expect(question.items).toHaveLength(4);
    expect(question.items.length).toBeGreaterThanOrEqual(3);
    expect(question.items.length).toBeLessThanOrEqual(6);
    expect(new Set(question.items.map((item) => item.id)).size).toBe(question.items.length);
    expect(question.items.some((item) => item.id === question.correctAnswer)).toBe(true);
    expect(question.items.every((item) => item.label.trim().length > 0)).toBe(true);
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
