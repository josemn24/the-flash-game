import { expect, it } from "vitest";
import { listRehearsals } from "@/infrastructure/rehearsals/catalog";
import { rehearsalCompatibility } from "./structure";
import type { RehearsalSource } from "@/types/gameplay/rehearsal";

const sources = listRehearsals().map((a) => a.source);
function questionSource(type: string): RehearsalSource {
  const source = sources.find((s) => s.questions.some((q) => q.type === type))!;
  return { ...source, questions: [source.questions.find((q) => q.type === type)!] };
}
it.each([
  ["multiple-choice", "options", []],
  ["odd-one-out", "items", []],
  ["matching", "rightItems", []],
  ["connect-pairs", "requireFullCoverage", false],
  ["progressive-clues", "cluePenalty", 99],
  ["progressive-image", "revealDurationMs", 12345],
  ["ordering", "items", []],
  ["classification", "categories", []],
  ["logic-matrix", "optionIds", []],
  ["queens", "prefilledQueens", []],
  ["zip", "checkpoints", []],
  ["escape", "initialBlocks", []],
  ["anagram", "tiles", []],
  ["word-hashtag", "maxMoves", 1000],
  ["word-search", "targets", []],
  ["mini-wordle", "maxAttempts", 99],
  ["logic-code", "codeLength", 99],
  ["estimation", "step", 999],
])("rejects a changed %s mechanic (%s)", (type, key, value) => {
  const source = questionSource(type as string);
  const q = source.questions[0]!;
  const changed = {
    ...source,
    questions: [{ ...q, publicPayload: { ...q.publicPayload, [key as string]: value } }],
  };
  expect(rehearsalCompatibility(source, changed)).not.toEqual([]);
});
it.each([
  ["heat-map", "toleranceRadius"],
  ["estimation", "tolerance"],
  ["mini-wordle", "dictionaryId"],
])("preserves private %s mechanical parameter %s", (type, key) => {
  const source = questionSource(type);
  const q = source.questions[0]!;
  const changed = {
    ...source,
    questions: [{ ...q, solutionPayload: { ...q.solutionPayload, [key]: "different" } }],
  };
  expect(rehearsalCompatibility(source, changed)).not.toEqual([]);
});
it.each(["points", "timeLimitMs", "payloadSchemaVersion"])("preserves question %s", (key) => {
  const source = questionSource("true-false");
  const q = source.questions[0]!;
  expect(
    rehearsalCompatibility(source, { ...source, questions: [{ ...q, [key]: 999 }] }),
  ).not.toEqual([]);
});
it("preserves survival lives, alphabet letters, global clock and board dimensions", () => {
  const survival = sources.find((s) => s.mode === "survival")!;
  expect(rehearsalCompatibility(survival, { ...survival, modeConfig: { lives: 1 } })).not.toEqual(
    [],
  );
  const alphabet = questionSource("short-text");
  const q = alphabet.questions[0]!;
  expect(
    rehearsalCompatibility(alphabet, {
      ...alphabet,
      questions: [{ ...q, modeConfig: { letter: "Z" } }],
    }),
  ).not.toEqual([]);
  expect(rehearsalCompatibility(alphabet, { ...alphabet, globalTimeLimitMs: 1 })).not.toEqual([]);
  const queens = questionSource("queens");
  const board = queens.questions[0]!;
  expect(
    rehearsalCompatibility(queens, {
      ...queens,
      questions: [
        { ...board, publicPayload: { ...board.publicPayload, grid: { rows: 8, columns: 8 } } },
      ],
    }),
  ).not.toEqual([]);
});
it("accepts alternative statements, option labels, answers and board distribution", () => {
  const source = questionSource("multiple-choice");
  const q = source.questions[0]!;
  const options = q.publicPayload.options as string[];
  expect(
    rehearsalCompatibility(source, {
      ...source,
      questions: [
        {
          ...q,
          publicPayload: {
            ...q.publicPayload,
            question: "Otra pregunta",
            options: options.map((_, i) => `Opción ${i}`),
          },
          solutionPayload: { correctAnswer: "Opción 0" },
        },
      ],
    }),
  ).toEqual([]);
  const queens = questionSource("queens");
  const board = queens.questions[0]!;
  expect(
    rehearsalCompatibility(queens, {
      ...queens,
      questions: [
        {
          ...board,
          publicPayload: { ...board.publicPayload, regions: ["otra distribución"] },
          solutionPayload: { solution: [0, 7, 9, 14] },
        },
      ],
    }),
  ).toEqual([]);
});

it("preserves word-search lengths while allowing other words and placements", () => {
  const source = questionSource("word-search");
  const q = source.questions[0]!;
  const targets = q.publicPayload.targets as { id: string; word: string }[];
  expect(
    rehearsalCompatibility(source, {
      ...source,
      questions: [
        {
          ...q,
          publicPayload: {
            ...q.publicPayload,
            targets: targets.map((target, index) =>
              index === 0 ? { ...target, word: "SOL" } : target,
            ),
          },
        },
      ],
    }),
  ).not.toEqual([]);
});
