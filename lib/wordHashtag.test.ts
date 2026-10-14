import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateAnswerScore,
  evaluateAnswer,
  getTimedOutAnswer,
  isAnswerCorrect,
} from "@/lib/scoring";
import { evaluateWordHashtag } from "@/lib/scoringCore/questions/wordHashtag";
import { resolvePracticeQuestion } from "@/lib/scoringPractice";
import { minimumSwapsForSequences } from "@/lib/word-hashtag/minimumSwaps";
import {
  WORD_HASHTAG_ACTIVE_CELLS,
  applyWordHashtagSwap,
  analyzeWordHashtagAnswer,
  buildWordHashtagSolution,
  calculateMinimumWordHashtagSwaps,
  calculateWordHashtagMetrics,
  getWordHashtagWords,
  isValidWordHashtagConfiguration,
  isWordHashtagAnswer,
  normalizeWordHashtagWord,
  replayWordHashtagSwaps,
} from "@/lib/wordHashtag";
import type { WordHashtagQuestion } from "@/types/gameplay";

vi.mock("@/lib/word-hashtag/minimumSwaps", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/word-hashtag/minimumSwaps")>();
  return { ...original, minimumSwapsForSequences: vi.fn(original.minimumSwapsForSequences) };
});

beforeEach(() => vi.clearAllMocks());

export const wordHashtagQuestion: WordHashtagQuestion = {
  id: "word-hashtag-test",
  type: "word-hashtag",
  category: "Lengua",
  tags: {
    domains: ["language_communication"],
    topics: ["vocabulary", "spelling"],
    cognitiveSkills: ["logical_reasoning", "problem_solving"],
    formatSkills: ["deduction", "ordering"],
  },
  question: "Intercambia las letras amarillas para completar las cuatro palabras.",
  timeLimit: 20,
  points: 150,
  explanation: "Intercambiar A y E completa REUMA y PONER.",
  grid: { rows: 5, columns: 5 },
  words: { top: "YOGUI", bottom: "REUMA", left: "PONER", right: "QUEMA" },
  initialLetters: [
    null,
    "P",
    null,
    "Q",
    null,
    "Y",
    "O",
    "G",
    "U",
    "I",
    null,
    "N",
    null,
    "E",
    null,
    "R",
    "A",
    "U",
    "M",
    "E",
    null,
    "R",
    null,
    "A",
    null,
  ],
  maxMoves: 3,
};

function boardFromActive(letters: string[]) {
  const board: Array<string | null> = Array.from({ length: 25 }, () => null);
  WORD_HASHTAG_ACTIVE_CELLS.forEach((cell, index) => {
    board[cell] = letters[index];
  });
  return board;
}

describe("Word Hashtag", () => {
  it("builds the four crossing solution words and normalizes Spanish letters", () => {
    const solution = buildWordHashtagSolution(wordHashtagQuestion.words)!;
    expect(getWordHashtagWords(solution)).toEqual({
      top: "YOGUI",
      bottom: "REUMA",
      left: "PONER",
      right: "QUEMA",
    });
    expect(normalizeWordHashtagWord(" árbol ")).toBe("ARBOL");
    expect(normalizeWordHashtagWord("niño")).toBe("NIÑO");
    expect(buildWordHashtagSolution({ ...wordHashtagQuestion.words, bottom: "RUEMA" })).toBeNull();
  });

  it("validates and solves the reference board with one legal swap", () => {
    expect(isValidWordHashtagConfiguration(wordHashtagQuestion)).toBe(true);
    const solution = buildWordHashtagSolution(wordHashtagQuestion.words)!;
    expect(calculateMinimumWordHashtagSwaps(wordHashtagQuestion.initialLetters, solution)).toBe(1);

    const replay = replayWordHashtagSwaps(wordHashtagQuestion, [{ fromCell: 16, toCell: 19 }]);
    expect(replay).toMatchObject({ valid: true, appliedMoves: 1, solved: true });
    expect(getWordHashtagWords(replay.letters)).toEqual({
      top: "YOGUI",
      bottom: "REUMA",
      left: "PONER",
      right: "QUEMA",
    });
    expect(
      calculateWordHashtagMetrics(wordHashtagQuestion, {
        swaps: [{ fromCell: 16, toCell: 19 }],
      }),
    ).toMatchObject({
      valid: true,
      correctCells: 16,
      completedWords: 4,
      movesUsed: 1,
      movesRemaining: 2,
      optimalMoves: 1,
      solved: true,
    });
  });

  it("calculates minimum swaps when the board contains repeated letters", () => {
    const targetLetters = Array.from("ABCADEAFGHIJKLMN");
    const initialLetters = [...targetLetters];
    [initialLetters[0], initialLetters[1]] = [initialLetters[1], initialLetters[0]];
    const target = boardFromActive(targetLetters);
    const initial = boardFromActive(initialLetters);
    expect(calculateMinimumWordHashtagSwaps(initial, target)).toBe(1);
  });

  it("rejects swaps involving locked, inactive, equal or repeated cells", () => {
    expect(
      applyWordHashtagSwap(wordHashtagQuestion, wordHashtagQuestion.initialLetters, {
        fromCell: 6,
        toCell: 16,
      }),
    ).toBeNull();
    expect(
      applyWordHashtagSwap(wordHashtagQuestion, wordHashtagQuestion.initialLetters, {
        fromCell: 0,
        toCell: 16,
      }),
    ).toBeNull();
    expect(
      applyWordHashtagSwap(wordHashtagQuestion, wordHashtagQuestion.initialLetters, {
        fromCell: 16,
        toCell: 16,
      }),
    ).toBeNull();

    const equalLetters = [...wordHashtagQuestion.initialLetters];
    equalLetters[16] = "E";
    expect(
      applyWordHashtagSwap(wordHashtagQuestion, equalLetters, { fromCell: 13, toCell: 16 }),
    ).toBeNull();
  });

  it("stops replay at manipulated or excessive swaps", () => {
    expect(
      replayWordHashtagSwaps(wordHashtagQuestion, [{ fromCell: 6, toCell: 16 }]),
    ).toMatchObject({ valid: false, appliedMoves: 0, errorIndex: 0, solved: false });
    expect(
      replayWordHashtagSwaps({ ...wordHashtagQuestion, maxMoves: 0 }, [
        { fromCell: 16, toCell: 19 },
      ]),
    ).toMatchObject({ valid: false, appliedMoves: 0, errorIndex: 0 });
  });

  it("rejects malformed and unreachable configurations and answers", () => {
    const solution = buildWordHashtagSolution(wordHashtagQuestion.words)!;
    expect(
      isValidWordHashtagConfiguration({
        ...wordHashtagQuestion,
        words: { ...wordHashtagQuestion.words, bottom: "RUEMA" },
      }),
    ).toBe(false);
    expect(
      isValidWordHashtagConfiguration({
        ...wordHashtagQuestion,
        initialLetters: wordHashtagQuestion.initialLetters.slice(1),
      }),
    ).toBe(false);
    expect(
      isValidWordHashtagConfiguration({
        ...wordHashtagQuestion,
        initialLetters: wordHashtagQuestion.initialLetters.map((letter, cell) =>
          cell === 16 ? "Z" : letter,
        ),
      }),
    ).toBe(false);
    expect(
      isValidWordHashtagConfiguration({ ...wordHashtagQuestion, initialLetters: solution }),
    ).toBe(false);
    expect(isValidWordHashtagConfiguration({ ...wordHashtagQuestion, maxMoves: 0 })).toBe(false);
    expect(isWordHashtagAnswer({ swaps: [{ fromCell: 16, toCell: 19 }] })).toBe(true);
    expect(isWordHashtagAnswer({ swaps: [{ fromCell: 16, toCell: "19" }] })).toBe(false);
  });

  it("scores speed and subtracts ten percent for each move above the minimum", () => {
    const solution = buildWordHashtagSolution(wordHashtagQuestion.words)!;
    const initialLetters = [...solution];
    [initialLetters[5], initialLetters[7]] = [initialLetters[7], initialLetters[5]];
    [initialLetters[9], initialLetters[11]] = [initialLetters[11], initialLetters[9]];
    const scoringQuestion = { ...wordHashtagQuestion, initialLetters, maxMoves: 4 };
    const optimalAnswer = {
      swaps: [
        { fromCell: 5, toCell: 7 },
        { fromCell: 9, toCell: 11 },
      ],
    };
    const inefficientAnswer = {
      swaps: [
        { fromCell: 5, toCell: 9 },
        { fromCell: 5, toCell: 11 },
        { fromCell: 5, toCell: 9 },
        { fromCell: 5, toCell: 7 },
      ],
    };

    expect(calculateWordHashtagMetrics(scoringQuestion, optimalAnswer).optimalMoves).toBe(2);
    expect(
      evaluateAnswer({ question: scoringQuestion, answer: optimalAnswer, timeUsed: 0 }),
    ).toMatchObject({ status: "correct", points: 150 });
    expect(
      evaluateAnswer({ question: scoringQuestion, answer: optimalAnswer, timeUsed: 20 }),
    ).toMatchObject({ status: "correct", points: 90 });
    expect(
      evaluateAnswer({ question: scoringQuestion, answer: inefficientAnswer, timeUsed: 0 }),
    ).toMatchObject({
      status: "correct",
      points: 120,
      details: { type: "word-hashtag", movesUsed: 4, optimalMoves: 2, solved: true },
    });
  });

  it("preserves timeout progress for review without granting partial points", () => {
    const draft = { swaps: [] };
    expect(getTimedOutAnswer(wordHashtagQuestion, { draftAnswer: draft, submittedCodes: [] })).toBe(
      draft,
    );
    expect(
      evaluateAnswer({
        question: wordHashtagQuestion,
        answer: draft,
        timeUsed: wordHashtagQuestion.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({
      status: "unanswered",
      isCorrect: false,
      points: 0,
      details: { type: "word-hashtag", correctCells: 14, movesUsed: 0, solved: false },
    });
  });
});

describe("Word Hashtag evaluation compatibility", () => {
  const solvedAnswer = { swaps: [{ fromCell: 16, toCell: 19 }] };
  const solvedDetails = {
    type: "word-hashtag",
    correctCells: 16,
    totalCells: 16,
    completedWords: 4,
    totalWords: 4,
    movesUsed: 1,
    movesRemaining: 2,
    optimalMoves: 1,
    solved: true,
  };
  const draftDetails = {
    ...solvedDetails,
    correctCells: 14,
    completedWords: 2,
    movesUsed: 0,
    movesRemaining: 3,
    solved: false,
  };
  const emptyDetails = {
    ...draftDetails,
    correctCells: 0,
    completedWords: 0,
    optimalMoves: 0,
  };

  it.each([
    [0, 150],
    [10, 120],
    [20, 90],
  ])("preserves the complete solved result at %i seconds", (timeUsed, points) => {
    expect(
      evaluateAnswer({ question: wordHashtagQuestion, answer: solvedAnswer, timeUsed }),
    ).toEqual({
      questionId: wordHashtagQuestion.id,
      answer: solvedAnswer,
      timeUsed,
      status: "correct",
      isCorrect: true,
      points,
      details: solvedDetails,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("preserves incomplete draft details with timeout=%s", (timedOut) => {
    const answer = { swaps: [] };
    expect(
      evaluateAnswer({ question: wordHashtagQuestion, answer, timeUsed: 20, timedOut }),
    ).toEqual({
      questionId: wordHashtagQuestion.id,
      answer,
      timeUsed: 20,
      status: timedOut ? "unanswered" : "incorrect",
      isCorrect: false,
      points: 0,
      details: draftDetails,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
  });

  it("keeps a solved late answer unanswered with its solved details and zero points", () => {
    expect(
      evaluateAnswer({
        question: wordHashtagQuestion,
        answer: solvedAnswer,
        timeUsed: 30,
        timedOut: true,
      }),
    ).toEqual({
      questionId: wordHashtagQuestion.id,
      answer: solvedAnswer,
      timeUsed: 20,
      status: "unanswered",
      isCorrect: true,
      points: 0,
      details: solvedDetails,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
  });

  it("preserves details for a null answer", () => {
    expect(
      evaluateAnswer({ question: wordHashtagQuestion, answer: null, timeUsed: 20, timedOut: true }),
    ).toEqual({
      questionId: wordHashtagQuestion.id,
      answer: null,
      timeUsed: 20,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      details: draftDetails,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
  });

  it("distinguishes malformed answers and configurations from invalid swap histories", () => {
    const malformedAnswer = { swaps: [{ fromCell: 16, toCell: "19" }] };
    expect(analyzeWordHashtagAnswer(wordHashtagQuestion, malformedAnswer)).toEqual({
      kind: "invalid-answer",
    });
    expect(
      evaluateAnswer({
        question: wordHashtagQuestion,
        answer: malformedAnswer as never,
        timeUsed: 0,
      }),
    ).toEqual({
      questionId: wordHashtagQuestion.id,
      answer: malformedAnswer,
      timeUsed: 0,
      status: "incorrect",
      isCorrect: false,
      points: 0,
    });
    expect(minimumSwapsForSequences).not.toHaveBeenCalled();

    const impossible = {
      ...wordHashtagQuestion,
      initialLetters: wordHashtagQuestion.initialLetters.map((letter, cell) =>
        cell === 16 ? "Z" : letter,
      ),
    };
    expect(analyzeWordHashtagAnswer(impossible, solvedAnswer)).toEqual({
      kind: "invalid-configuration",
    });
    expect(evaluateAnswer({ question: impossible, answer: solvedAnswer, timeUsed: 0 })).toEqual({
      questionId: impossible.id,
      answer: solvedAnswer,
      timeUsed: 0,
      status: "incorrect",
      isCorrect: false,
      points: 0,
    });
    expect(minimumSwapsForSequences).not.toHaveBeenCalled();

    const answer = { swaps: [{ fromCell: 6, toCell: 16 }] };
    expect(evaluateAnswer({ question: wordHashtagQuestion, answer, timeUsed: 0 })).toEqual({
      questionId: wordHashtagQuestion.id,
      answer,
      timeUsed: 0,
      status: "incorrect",
      isCorrect: false,
      points: 0,
      details: emptyDetails,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
    expect(calculateWordHashtagMetrics(wordHashtagQuestion, answer)).toEqual({
      valid: false,
      correctCells: 0,
      totalCells: 16,
      completedWords: 0,
      totalWords: 4,
      movesUsed: 0,
      movesRemaining: 3,
      optimalMoves: 0,
      solved: false,
    });
  });

  it("calculates the minimum once for the direct evaluator and each public helper", () => {
    const question = resolvePracticeQuestion(wordHashtagQuestion);
    expect(
      evaluateWordHashtag({
        question,
        answer: solvedAnswer,
        timeUsed: 0,
        submittedCodes: [],
        incorrectAttempts: 0,
        revealedClues: 1,
      }),
    ).toEqual({
      status: "correct",
      isCorrect: true,
      points: 150,
      details: solvedDetails,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    expect(calculateAnswerScore(wordHashtagQuestion, solvedAnswer, 0)).toBe(150);
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    expect(isAnswerCorrect(wordHashtagQuestion, solvedAnswer)).toBe(true);
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    expect(calculateWordHashtagMetrics(wordHashtagQuestion, solvedAnswer)).toEqual({
      valid: true,
      correctCells: 16,
      totalCells: 16,
      completedWords: 4,
      totalWords: 4,
      movesUsed: 1,
      movesRemaining: 2,
      optimalMoves: 1,
      solved: true,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
  });

  it("preserves normalization, including decomposed Ñ, without mutating the question", () => {
    const question = {
      ...wordHashtagQuestion,
      words: { top: "yn\u0303gui", bottom: "reúma", left: "pn\u0303ner", right: "quema" },
      initialLetters: wordHashtagQuestion.initialLetters.map((letter, cell) =>
        cell === 6 ? "n\u0303" : (letter?.toLowerCase() ?? null),
      ),
    };
    const original = structuredClone(question);
    expect(evaluateAnswer({ question, answer: solvedAnswer, timeUsed: 0 })).toEqual({
      questionId: question.id,
      answer: solvedAnswer,
      timeUsed: 0,
      status: "correct",
      isCorrect: true,
      points: 150,
      details: solvedDetails,
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(1);
    expect(question).toEqual(original);
  });

  it("recomputes mutated configuration data on the next evaluation", () => {
    const question = structuredClone(wordHashtagQuestion);
    expect(calculateAnswerScore(question, solvedAnswer, 0)).toBe(150);
    question.maxMoves = 5;
    [question.initialLetters[5], question.initialLetters[7]] = [
      question.initialLetters[7],
      question.initialLetters[5],
    ];
    const answer = { swaps: [...solvedAnswer.swaps, { fromCell: 5, toCell: 7 }] };
    expect(evaluateAnswer({ question, answer, timeUsed: 0 })).toEqual({
      questionId: question.id,
      answer,
      timeUsed: 0,
      status: "correct",
      isCorrect: true,
      points: 150,
      details: { ...solvedDetails, movesUsed: 2, movesRemaining: 3, optimalMoves: 2 },
    });
    expect(minimumSwapsForSequences).toHaveBeenCalledTimes(2);
  });

  it("preserves the board at the first invalid replay step without running the minimum search", () => {
    const answer = [...solvedAnswer.swaps, { fromCell: 16, toCell: 19 }];
    const solution = buildWordHashtagSolution(wordHashtagQuestion.words)!;
    expect(replayWordHashtagSwaps(wordHashtagQuestion, answer)).toEqual({
      valid: false,
      letters: solution,
      appliedMoves: 1,
      errorIndex: 1,
      solved: true,
    });
    expect(replayWordHashtagSwaps({ ...wordHashtagQuestion, maxMoves: 1 }, answer)).toEqual({
      valid: false,
      letters: solution,
      appliedMoves: 1,
      errorIndex: 1,
      solved: true,
    });
    expect(minimumSwapsForSequences).not.toHaveBeenCalled();
  });
});
