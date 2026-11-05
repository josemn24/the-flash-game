import { expect, it } from "vitest";
import { parseFlashEditorialQuestionDocument, parseFlashEditorialDocument } from "./flashDocument";
import { SBR_QUESTIONS } from "@/scripts/fixtures/scenarios/sbr.mjs";
const question = Object.fromEntries(
  Object.entries(SBR_QUESTIONS[0]!).filter(([key]) => key !== "points"),
);
it("normalizes legacy metadata and keeps difficulty outside the payload", () => {
  const original = structuredClone(question);
  expect(parseFlashEditorialQuestionDocument(question).difficulty).toBe("medium");
  const parsed = parseFlashEditorialQuestionDocument({ ...question, difficulty: "hard" });
  expect(parsed.difficulty).toBe("hard");
  expect(parsed.publicPayload).toEqual(question.publicPayload);
  expect(question).toEqual(original);
  expect(() =>
    parseFlashEditorialQuestionDocument({ ...question, difficulty: "unknown" }),
  ).toThrow();
});
it("preserves explicit difficulty in inline challenge questions", () => {
  const doc = {
    challenge: {
      slug: "difficulty-flash",
      title: "Clasificación",
      subtitle: "",
      description: "",
      mode: "flash",
      configSchemaVersion: 1,
      modeConfig: {},
    },
    questions: [
      { ...question, slug: "first", points: 50, difficulty: "easy" },
      { ...question, slug: "second", points: 50, difficulty: "hard" },
    ],
  };
  const result = parseFlashEditorialDocument(doc);
  expect(result.questions.map((q) => ("source" in q ? null : q.difficulty))).toEqual([
    "easy",
    "hard",
  ]);
});
