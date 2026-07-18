import { describe, expect, it } from "vitest";
import { stages } from "@/data/stages";
import { QUESTION_FORMAT_CATALOG, questionFormats } from "@/features/question-formats/catalog";

describe("question format catalog", () => {
  it("contains exactly eighteen formats with unique slugs", () => {
    expect(questionFormats).toHaveLength(18);
    expect(new Set(questionFormats.map((format) => format.slug)).size).toBe(18);
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
      "heat-map",
      "image-labeling",
      "flash-memory",
      "simon-sequence",
      "logic-matrix",
      "mini-sudoku",
      "mini-nonogram",
      "sliding-puzzle",
    ]);
    expect(questionFormats.every((format) => format.examples.length > 0)).toBe(true);
    const exampleIds = questionFormats.flatMap((format) =>
      format.examples.map((example) => example.question.id),
    );
    expect(new Set(exampleIds).size).toBe(exampleIds.length);
  });

  it("keeps the heat-map example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["heat-map"].examples[0].question;
    expect(question.surface.src).toBe("/visuals/heat-map/spain-map.svg");
    expect(question.surface.width).toBeGreaterThan(0);
    expect(question.surface.height).toBeGreaterThan(0);
    expect(question.fullCreditRadius).toBeGreaterThan(0);
    expect(question.toleranceRadius).toBeGreaterThan(question.fullCreditRadius);
    expect(question.target.x).toBeGreaterThanOrEqual(0);
    expect(question.target.x).toBeLessThanOrEqual(1);
    expect(question.target.y).toBeGreaterThanOrEqual(0);
    expect(question.target.y).toBeLessThanOrEqual(1);
  });

  it("keeps both image-labeling examples internally consistent", () => {
    const examples = QUESTION_FORMAT_CATALOG["image-labeling"].examples;
    expect(examples).toHaveLength(2);
    expect(examples.map((example) => example.title)).toEqual([
      "Etiquetado múltiple",
      "Etiquetado único",
    ]);
    const question = examples[0].question;
    expect(question.task).toBe("assign-all");
    if (question.task !== "assign-all") throw new Error("Expected assign-all example");
    const anchorIds = question.anchors.map((anchor) => anchor.id);
    const labelIds = question.labels.map((label) => label.id);
    expect(question.surface.src).toBe("/visuals/heat-map/human-body.svg");
    expect(question.surface.width).toBeGreaterThan(0);
    expect(question.surface.height).toBeGreaterThan(0);
    expect(question.anchors).toHaveLength(5);
    expect(question.labels.length).toBeGreaterThanOrEqual(question.anchors.length);
    expect(new Set(anchorIds).size).toBe(anchorIds.length);
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(question.labels.every((label) => label.label.trim().length > 0)).toBe(true);
    expect(question.anchors.every((anchor) => labelIds.includes(anchor.correctLabelId))).toBe(true);
    expect(question.anchors.every((anchor) => anchor.point.x >= 0 && anchor.point.x <= 1)).toBe(
      true,
    );
    expect(question.anchors.every((anchor) => anchor.point.y >= 0 && anchor.point.y <= 1)).toBe(
      true,
    );

    const single = examples[1].question;
    expect(single.task).toBe("identify-one");
    if (single.task !== "identify-one") throw new Error("Expected identify-one example");
    expect(single.response.kind).toBe("choice");
    expect(single.target).toEqual({ x: 0.5, y: 0.6 });
    if (single.response.kind !== "choice") throw new Error("Expected choice response");
    expect(single.response.options).toContain(single.response.correctAnswer);
  });

  it("keeps the progressive-clues example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-clues"].examples[0].question;
    expect(question.clues.length).toBeGreaterThanOrEqual(2);
    expect(question.clues.every((clue) => clue.trim().length > 0)).toBe(true);
    expect(question.acceptedAnswers).toContain(question.correctAnswer);
    expect(question.cluePenalty).toBeGreaterThan(0);
    expect(question.cluePenalty * (question.clues.length - 1)).toBeLessThan(question.points);
  });

  it("keeps the matching example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG.matching.examples[0].question;
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
    const question = QUESTION_FORMAT_CATALOG["odd-one-out"].examples[0].question;
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
