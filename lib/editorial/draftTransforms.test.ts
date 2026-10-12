import { describe, expect, it } from "vitest";
import type { FlashEditorialDocument } from "@/types/view-models/editorial";
import {
  changeEditorialLives,
  changeEditorialMode,
  replaceEditorialLibraryQuestion,
} from "./draftTransforms";
import { emptyEditorialDocument } from "./emptyDocument";

describe("editorial draft transformations", () => {
  it("changes mode without mutating questions, points or the source document", () => {
    const before = structuredClone(emptyEditorialDocument);
    const survival = changeEditorialMode(emptyEditorialDocument, "survival");
    expect(survival.challenge.modeConfig).toEqual({ lives: 2 });
    expect(survival.questions).toEqual(before.questions);
    expect(changeEditorialLives(survival, 1).challenge.modeConfig).toEqual({ lives: 1 });
    expect(survival.challenge.modeConfig).toEqual({ lives: 2 });
    expect(changeEditorialLives(emptyEditorialDocument, 1)).toBe(emptyEditorialDocument);
    expect(emptyEditorialDocument).toEqual(before);
  });

  it("creates pyramid briefings and removes them when changing to another mode", () => {
    const pyramid = changeEditorialMode(emptyEditorialDocument, "pyramid");
    expect(pyramid.questions[1].modeConfig).toMatchObject({
      levelId: "level-2",
      label: "Nivel 2",
      briefing: { format: "Prueba competitiva" },
    });
    const alphabet = changeEditorialMode(pyramid, "alphabet");
    expect(alphabet.challenge.globalTimeLimitMs).toBe(300000);
    expect(alphabet.questions.every((question) => !("modeConfig" in question))).toBe(true);
    expect(changeEditorialMode(alphabet, "flash").challenge.globalTimeLimitMs).toBeUndefined();
    expect(pyramid.questions[1].modeConfig).toHaveProperty("briefing");
  });

  it("preserves an alphabet draft's edited global time limit", () => {
    const alphabet = changeEditorialMode(emptyEditorialDocument, "alphabet");
    expect(
      changeEditorialMode(
        { ...alphabet, challenge: { ...alphabet.challenge, globalTimeLimitMs: 90000 } },
        "alphabet",
      ).challenge.globalTimeLimitMs,
    ).toBe(90000);
  });

  it("replaces a library reference while preserving item identity, points and pyramid configuration", () => {
    const document: FlashEditorialDocument = {
      ...changeEditorialMode(emptyEditorialDocument, "pyramid"),
      questions: [
        {
          source: "library",
          questionVersionId: "original",
          challengeItemId: "item-id",
          points: 35,
          modeConfig: {
            levelId: "custom-level",
            label: "Mi nivel",
            briefing: { title: "Mi prueba", format: "queens", description: "Resuelve" },
          },
        },
      ],
    };
    const before = structuredClone(document);
    const replaced = replaceEditorialLibraryQuestion(document, 0, {
      questionVersionId: "replacement",
      type: "zip",
    });
    expect(replaced.questions[0]).toEqual({
      ...document.questions[0],
      questionVersionId: "replacement",
    });
    expect(document).toEqual(before);
    const flash = changeEditorialMode(replaced, "flash");
    expect(flash.questions[0].modeConfig).toEqual({});
    expect(flash.questions[0].points).toBe(35);
  });
});
