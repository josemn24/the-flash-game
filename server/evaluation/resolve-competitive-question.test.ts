import { describe, expect, it } from "vitest";
import { resolveCompetitiveQuestion } from "./resolve-competitive-question";
import type {
  PublicQuestionOfType,
  QuestionContractMap,
  QuestionReveal,
  QuestionSolutionOfType,
  QuestionType,
} from "@/types/contracts";
import type { DurationMs } from "@/types/domain/values";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { ResolvedQuestion } from "@/types/gameplay/scoring";

const questionVersionId = "question-version:matching:v1" as QuestionVersionId;
const tags = {
  domains: [],
  topics: [],
  cognitiveSkills: [],
  formatSkills: [],
  lifeSkills: [],
} as const;

const imageSurface = {
  src: "/visuals/test.png",
  alt: "Test image",
  width: 100,
  height: 100,
} as const;

function publicQuestionOf<Type extends QuestionType>(
  type: Type,
  payload: QuestionContractMap[Type]["public"],
): PublicQuestionOfType<Type> {
  return {
    id: questionVersionId,
    type,
    category: "Test",
    tags,
    prompt: `Prompt for ${type}`,
    context: null,
    timeLimitMs: 30_000 as DurationMs,
    payload,
  };
}

function solutionOf<Type extends QuestionType>(
  type: Type,
  payload: QuestionContractMap[Type]["solution"],
): QuestionSolutionOfType<Type> {
  return {
    questionVersionId,
    type,
    explanation: `Explanation for ${type}`,
    payload,
  };
}

function resolveCase<Type extends QuestionType>(
  type: Type,
  publicPayload: QuestionContractMap[Type]["public"],
  solutionPayload: QuestionContractMap[Type]["solution"],
  reveals?: readonly QuestionReveal[],
): ResolvedQuestion {
  return resolveCompetitiveQuestion({
    publicQuestion: publicQuestionOf(type, publicPayload),
    solution: solutionOf(type, solutionPayload),
    points: 100,
    reveals,
  });
}

type ResolutionCase = {
  readonly name: string;
  readonly resolve: () => ResolvedQuestion;
  readonly assert: (resolved: ResolvedQuestion) => void;
};

function typeCase<Type extends QuestionType>(
  type: Type,
  publicPayload: QuestionContractMap[Type]["public"],
  solutionPayload: QuestionContractMap[Type]["solution"],
  reveals?: readonly QuestionReveal[],
): ResolutionCase {
  return {
    name: type,
    resolve: () => resolveCase(type, publicPayload, solutionPayload, reveals),
    assert: (resolved) => expect(resolved.type).toBe(type),
  };
}

const resolutionCases: readonly ResolutionCase[] = [
  typeCase(
    "multiple-choice",
    { options: ["A"], media: null, promptVisual: null },
    { correctAnswer: "A" },
  ),
  typeCase("odd-one-out", { items: [{ id: "a", label: "A" }] }, { correctAnswer: "a" }),
  typeCase(
    "matching",
    {
      leftItems: [{ id: "left", label: "Left" }],
      rightItems: [{ id: "right", label: "Right" }],
    },
    { matches: { left: "right" } },
  ),
  typeCase(
    "connect-pairs",
    {
      grid: { rows: 5, columns: 5 },
      pairs: [{ id: "pair", label: "Pair", symbol: "P", endpoints: [0, 1] }],
      requireFullCoverage: true,
    },
    { paths: { pair: [0, 1] } },
  ),
  typeCase("true-false", null, { correctAnswer: true }),
  typeCase("short-text", null, { correctAnswer: "answer", acceptedAnswers: ["answer"] }),
  typeCase(
    "progressive-clues",
    { clueCount: 1, cluePenalty: 10 },
    { correctAnswer: "answer", acceptedAnswers: ["answer"] },
    [
      {
        questionVersionId,
        type: "progressive-clues",
        payload: { clueIndex: 0, clue: "A clue" },
      },
    ],
  ),
  typeCase(
    "progressive-image",
    {
      surface: imageSurface,
      revealDurationMs: 1_000 as DurationMs,
      answerLabel: null,
      answerPlaceholder: null,
    },
    { correctAnswer: "answer", acceptedAnswers: ["answer"], solutionAlt: "Solution" },
  ),
  typeCase(
    "heat-map",
    { surface: imageSurface, targetLabel: "Target" },
    { target: { x: 0.5, y: 0.5 }, fullCreditRadius: 0.1, toleranceRadius: 0.2 },
  ),
  typeCase(
    "image-labeling",
    {
      task: "assign-all",
      surface: imageSurface,
      anchors: [{ id: "anchor", point: { x: 0.5, y: 0.5 } }],
      labels: [{ id: "label", label: "Label" }],
    },
    { task: "assign-all", labelsByAnchorId: { anchor: "label" } },
  ),
  typeCase(
    "image-labeling",
    {
      task: "identify-one",
      surface: imageSurface,
      target: { x: 0.5, y: 0.5 },
      response: { kind: "choice", options: ["Label"] },
    },
    { task: "identify-one", correctAnswer: "Label", acceptedAnswers: ["Label"] },
  ),
  typeCase("ordering", { items: ["A", "B"], directionLabels: null }, { correctOrder: ["A", "B"] }),
  typeCase(
    "classification",
    { items: [{ label: "A" }], categories: ["Category"] },
    { categoriesByItem: { A: "Category" } },
  ),
  typeCase(
    "flash-memory",
    {
      revealDurationMs: 1_000 as DurationMs,
      grid: { rows: 1, columns: 1 },
      items: [{ id: "a", label: "A" }],
    },
    { positionsByItemId: { a: 0 } },
  ),
  typeCase(
    "memory-pairs",
    {
      grid: { rows: 1, columns: 2 },
      tiles: [{ id: "a" }, { id: "b" }],
      mismatchRevealDurationMs: null,
    },
    { pairByTileId: { a: "pair", b: "pair" } },
    [
      {
        questionVersionId,
        type: "memory-pairs",
        payload: { tile: { id: "a", label: "A" } },
      },
    ],
  ),
  typeCase("simon-sequence", { pads: [{ id: "a", label: "A" }] }, { sequence: ["a"] }),
  typeCase(
    "logic-matrix",
    {
      pieces: [{ id: "piece", symbol: "P", label: "Piece" }],
      cells: [null],
      optionIds: ["option"],
      showPieceLabels: null,
    },
    { correctOptionId: "option" },
  ),
  typeCase("mini-sudoku", { grid: [null] }, { solution: [1] }),
  typeCase("mini-nonogram", { rowClues: [[1]], columnClues: [[1]] }, { solution: [true] }),
  typeCase(
    "queens",
    { grid: { rows: 4, columns: 4 }, regions: [0], prefilledQueens: [] },
    { solution: [0, 1, 2, 3] },
  ),
  typeCase("time-maze", { grid: { rows: 1, columns: 1 }, cells: ["start"] }, null),
  typeCase(
    "zip",
    {
      grid: { rows: 5, columns: 5 },
      checkpoints: [{ value: 1, cell: 0 }],
      instruction: null,
      mapNote: null,
      boardLabel: null,
    },
    { solution: [0] },
  ),
  typeCase(
    "pipes",
    {
      grid: { rows: 5, columns: 5 },
      tiles: ["straight"],
      initialRotations: [0],
      source: 0,
    },
    { solutionRotations: [0] },
  ),
  typeCase("sliding-puzzle", { initialTiles: [0, null] }, { solution: [0, null] }),
  typeCase(
    "escape",
    {
      grid: { rows: 6, columns: 6, exit: { side: "right", row: 0 } },
      initialBlocks: [
        {
          id: "target",
          kind: "target",
          orientation: "horizontal",
          row: 0,
          column: 0,
          length: 2,
        },
      ],
      instruction: null,
      hideInstruction: false,
      objectiveLabel: null,
      hideObjectiveLabel: false,
      completionMessage: null,
      boardLabel: null,
    },
    { referenceSolution: [], optimalMoves: 0 },
  ),
  typeCase(
    "error-reconstruction",
    {
      steps: [{ id: "step", text: "Step" }],
      correctionOptions: ["Correction"],
      instruction: null,
      correctionLabel: null,
      correctionRequired: false,
      submitLabel: null,
    },
    { firstErrorStepId: "step", correctCorrection: null },
  ),
  typeCase("anagram", { tiles: [{ id: "a", value: "A" }], hint: null }, { correctAnswer: "A" }),
  typeCase(
    "word-hashtag",
    { grid: { rows: 5, columns: 5 }, initialLetters: [null], maxMoves: 1 },
    { words: { top: "A", bottom: "B", left: "C", right: "D" } },
  ),
  typeCase(
    "word-search",
    { grid: { rows: 1, columns: 1 }, letters: ["A"], targets: [{ id: "target", word: "A" }] },
    { positionsByTargetId: { target: { startCell: 0, endCell: 0 } } },
  ),
  typeCase(
    "mini-wordle",
    { hint: null, wordLength: 4, maxAttempts: 6 },
    { correctAnswer: "TEST", additionalGuesses: [], dictionaryId: "es-general-4.v1" },
  ),
  typeCase(
    "logic-code",
    { clues: [{ code: "1", hint: "Hint" }], codeLength: 1 },
    { correctAnswer: "1" },
  ),
  typeCase(
    "estimation",
    { min: 0, max: 10, step: 1, initialValue: 5, unit: "points", media: null },
    { correctAnswer: 5, tolerance: 1 },
  ),
];

describe("resolveCompetitiveQuestion", () => {
  it("composes a public question and its private solution into the scoring projection", () => {
    const resolved = resolveCompetitiveQuestion({
      publicQuestion: {
        id: questionVersionId,
        type: "matching",
        category: "Geography",
        tags,
        prompt: "Match each country with its capital.",
        context: null,
        timeLimitMs: 30_000 as DurationMs,
        payload: {
          leftItems: [{ id: "es", label: "Spain" }],
          rightItems: [{ id: "mad", label: "Madrid" }],
        },
      },
      solution: {
        questionVersionId,
        type: "matching",
        explanation: "Madrid is the capital of Spain.",
        payload: { matches: { es: "mad" } },
      },
      points: 100,
    });

    expect(resolved).toMatchObject({
      type: "matching",
      points: 100,
      explanation: "Madrid is the capital of Spain.",
      leftItems: [{ id: "es", correctMatchId: "mad" }],
    });
  });

  it("keeps reveal-only data at the competitive boundary", () => {
    const resolved = resolveCompetitiveQuestion({
      publicQuestion: {
        id: questionVersionId,
        type: "progressive-clues",
        category: "Science",
        tags,
        prompt: "Identify the concept.",
        context: null,
        timeLimitMs: 45_000 as DurationMs,
        payload: { clueCount: 2, cluePenalty: 10 },
      },
      solution: {
        questionVersionId,
        type: "progressive-clues",
        explanation: "The clues point to the answer.",
        payload: { correctAnswer: "gravity", acceptedAnswers: ["gravity"] },
      },
      reveals: [
        {
          questionVersionId,
          type: "progressive-clues",
          payload: { clueIndex: 0, clue: "It affects every object with mass." },
        },
      ],
      points: 80,
    });

    expect(resolved).toMatchObject({
      type: "progressive-clues",
      clues: ["It affects every object with mass.", "clue-2"],
      correctAnswer: "gravity",
    });
  });

  it.each(resolutionCases)("resolves the $name contract variant", ({ resolve, assert }) => {
    assert(resolve());
  });

  it("rejects a public question and solution with different types", () => {
    expect(() =>
      resolveCompetitiveQuestion({
        publicQuestion: publicQuestionOf("matching", {
          leftItems: [{ id: "left", label: "Left" }],
          rightItems: [{ id: "right", label: "Right" }],
        }),
        solution: solutionOf("multiple-choice", { correctAnswer: "A" }),
        points: 100,
      }),
    ).toThrow("Mismatched public and solution contracts for matching");
  });

  it("rejects image-labeling contracts with different tasks", () => {
    expect(() =>
      resolveCompetitiveQuestion({
        publicQuestion: publicQuestionOf("image-labeling", {
          task: "assign-all",
          surface: imageSurface,
          anchors: [{ id: "anchor", point: { x: 0.5, y: 0.5 } }],
          labels: [{ id: "label", label: "Label" }],
        }),
        solution: solutionOf("image-labeling", {
          task: "identify-one",
          correctAnswer: "Label",
          acceptedAnswers: ["Label"],
        }),
        points: 100,
      }),
    ).toThrow("Mismatched image-labeling public and solution contracts");
  });

  it("ignores reveals for other formats and uses the progressive fallback", () => {
    const resolved = resolveCase(
      "progressive-clues",
      { clueCount: 1, cluePenalty: 10 },
      { correctAnswer: "answer", acceptedAnswers: ["answer"] },
      [
        {
          questionVersionId,
          type: "memory-pairs",
          payload: { tile: { id: "tile", label: "Tile" } },
        },
      ],
    );

    expect(resolved).toMatchObject({ type: "progressive-clues", clues: ["clue-1"] });
  });
});
