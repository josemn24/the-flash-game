import { describe, expect, it } from "vitest";
import { stages } from "@/data/stages";
import { QUESTION_FORMAT_CATALOG, questionFormats } from "@/features/question-formats/catalog";

describe("question format catalog", () => {
  it("contains exactly ten formats with unique slugs", () => {
    expect(questionFormats).toHaveLength(10);
    expect(new Set(questionFormats.map((format) => format.slug)).size).toBe(10);
    expect(Object.keys(QUESTION_FORMAT_CATALOG)).toEqual([
      "multiple-choice",
      "odd-one-out",
      "matching",
      "true-false",
      "short-text",
      "ordering",
      "classification",
      "logic-code",
      "estimation",
      "progressive-clues",
    ]);
  });

  it("keeps the progressive-clues example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-clues"].example;
    expect(question.clues.length).toBeGreaterThanOrEqual(2);
    expect(question.clues.every((clue) => clue.trim().length > 0)).toBe(true);
    expect(question.acceptedAnswers).toContain(question.correctAnswer);
    expect(question.cluePenalty).toBeGreaterThan(0);
    expect(question.cluePenalty * (question.clues.length - 1)).toBeLessThan(question.points);
  });

  it("keeps the matching example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG.matching.example;
    const leftIds = question.leftItems.map((item) => item.id);
    const rightIds = question.rightItems.map((item) => item.id);
    expect(question.leftItems.length).toBeGreaterThanOrEqual(3);
    expect(question.leftItems.length).toBeLessThanOrEqual(6);
    expect(question.rightItems).toHaveLength(question.leftItems.length);
    expect(new Set(leftIds).size).toBe(leftIds.length);
    expect(new Set(rightIds).size).toBe(rightIds.length);
    expect(question.leftItems.every((item) => rightIds.includes(item.correctMatchId))).toBe(true);
    expect(question.leftItems.every((item) => item.label.trim().length > 0)).toBe(true);
    expect(question.rightItems.every((item) => item.label.trim().length > 0)).toBe(true);
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
