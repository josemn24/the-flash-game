import { describe, expect, it } from "vitest";
import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import {
  parseEditableEditorialJson,
  parseFlashEditorialDocument,
  parseFlashEditorialQuestionDocument,
} from "./flashDocument";
import {
  changeEditorialGlobalDuration,
  changeEditorialMode,
  moveEditorialQuestion,
  replaceEditorialLibraryQuestion,
  changeEditorialQuestionPoints,
} from "./draftTransforms";
import { emptyEditorialDocument } from "./emptyDocument";

const queen = {
  slug: "queens-1",
  type: "queens",
  payloadSchemaVersion: 1,
  timeLimitMs: 1000,
  points: 30,
  publicPayload: {
    question: "Cinco coronas",
    grid: { rows: 5, columns: 5 },
    regions: [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3],
    prefilledQueens: [2],
  },
  solutionPayload: { solution: [2, 9, 10, 18, 21] },
};
const document = () => ({
  challenge: { ...emptyEditorialDocument.challenge, mode: "time-trial", globalTimeLimitMs: 60000 },
  questions: [queen, { ...queen, slug: "queens-2", points: 70 }],
});
describe("Contrarreloj editorial contract", () => {
  it("admits inline Queens and library references without per-question time affecting the global clock", () => {
    const parsed = parseFlashEditorialDocument(document());
    expect(parsed.challenge.globalTimeLimitMs).toBe(60000);
    expect(parsed.questions[0].points).toBe(30);
    const standalone = { ...queen };
    Reflect.deleteProperty(standalone, "points");
    expect(parseFlashEditorialQuestionDocument(standalone).type).toBe("queens");
    const replaced = replaceEditorialLibraryQuestion(parsed, 0, {
      questionVersionId: "00000000-0000-0000-0000-000000000001",
      type: "queens",
    });
    expect(parseFlashEditorialDocument(replaced).questions[0].points).toBe(30);
  });
  it.each([undefined, 0, -1000, 1001, 2147484000, 1000.5])(
    "rejects invalid global duration %s",
    (globalTimeLimitMs) => {
      const draft = document();
      expect(() =>
        parseFlashEditorialDocument({
          ...draft,
          challenge: { ...draft.challenge, globalTimeLimitMs },
        }),
      ).toThrow(/Contrarreloj/);
    },
  );
  it.each([1, 21])("rejects %i boards", (count) => {
    const draft = document();
    expect(() =>
      parseFlashEditorialDocument({
        ...draft,
        questions: Array.from({ length: count }, (_, index) => ({
          ...queen,
          slug: `q-${index}`,
          points: 1,
        })),
      }),
    ).toThrow(/entre 2 y 20/);
  });
  it("accepts twenty boards with positive integer weights summing to 100", () => {
    expect(
      parseFlashEditorialDocument({
        ...document(),
        questions: Array.from({ length: 20 }, (_, index) => ({
          ...queen,
          slug: `q-${index}`,
          points: 5,
        })),
      }).questions,
    ).toHaveLength(20);
  });
  it("rejects incompatible formats, invalid solutions and weights not summing to 100", () => {
    expect(() =>
      parseFlashEditorialDocument({ ...document(), questions: emptyEditorialDocument.questions }),
    ).toThrow(/únicamente/);
    expect(() =>
      parseFlashEditorialDocument({
        ...document(),
        questions: [
          { ...queen, solutionPayload: { solution: [0, 1, 2, 3, 4] } },
          document().questions[1],
        ],
      }),
    ).toThrow(/solución válida/);
    expect(() =>
      parseFlashEditorialDocument({
        ...document(),
        questions: [queen, { ...queen, slug: "q2", points: 69 }],
      }),
    ).toThrow(/sumar 100/);
  });
  it("keeps incomplete drafts editable without creating a duration default or redistributing points", () => {
    const incomplete = changeEditorialMode(emptyEditorialDocument, "time-trial");
    expect(incomplete.challenge.globalTimeLimitMs).toBeUndefined();
    expect(parseEditableEditorialJson(JSON.stringify(incomplete)).challenge.mode).toBe(
      "time-trial",
    );
    const valid = parseFlashEditorialDocument(document());
    const moved = moveEditorialQuestion(valid, 1, -1);
    expect(moved.questions.map((q) => q.points)).toEqual([70, 30]);
    expect(changeEditorialGlobalDuration(valid, "45").challenge.globalTimeLimitMs).toBe(45000);
    expect(changeEditorialGlobalDuration(valid, "").challenge.globalTimeLimitMs).toBeUndefined();
    const edited = changeEditorialQuestionPoints(valid, 0, 25);
    expect(parseEditableEditorialJson(JSON.stringify(edited)).questions[1].points).toBe(70);
    expect(() => parseFlashEditorialDocument(edited)).toThrow(/sumar 100/);
  });
  it("enables only Queens for the new mode", () => {
    expect(competitiveCapabilityFor("queens", "time-trial")).toBeTruthy();
    for (const type of ["escape", "matching", "mini-wordle", "word-hashtag"] as const)
      expect(competitiveCapabilityFor(type, "time-trial")).toBeNull();
  });
});
