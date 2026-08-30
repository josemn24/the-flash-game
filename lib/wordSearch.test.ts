import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { evaluateAnswer } from "@/lib/scoring";
import {
  calculateWordSearchMetrics,
  findWordSearchTarget,
  getWordSearchPath,
  isValidWordSearchConfiguration,
  isWordSearchAnswer,
} from "@/lib/wordSearch";

const question = QUESTION_FORMAT_CATALOG["word-search"].examples[0].question;

describe("word search", () => {
  it("keeps the curated board internally consistent and unique", () => {
    expect(isValidWordSearchConfiguration(question)).toBe(true);
    expect(question.letters).toHaveLength(64);
    expect(question.targets).toHaveLength(5);
  });

  it("builds straight paths in all eight directions", () => {
    const grid = { rows: 8, columns: 8 };
    expect(getWordSearchPath(grid, 0, 4)).toEqual([0, 1, 2, 3, 4]);
    expect(getWordSearchPath(grid, 4, 0)).toEqual([4, 3, 2, 1, 0]);
    expect(getWordSearchPath(grid, 0, 32)).toEqual([0, 8, 16, 24, 32]);
    expect(getWordSearchPath(grid, 32, 0)).toEqual([32, 24, 16, 8, 0]);
    expect(getWordSearchPath(grid, 0, 36)).toEqual([0, 9, 18, 27, 36]);
    expect(getWordSearchPath(grid, 36, 0)).toEqual([36, 27, 18, 9, 0]);
    expect(getWordSearchPath(grid, 7, 35)).toEqual([7, 14, 21, 28, 35]);
    expect(getWordSearchPath(grid, 35, 7)).toEqual([35, 28, 21, 14, 7]);
    expect(getWordSearchPath(grid, 0, 19)).toBeNull();
  });

  it("matches a target from either endpoint", () => {
    expect(findWordSearchTarget(question, 17, 53)?.id).toBe("panda");
    expect(findWordSearchTarget(question, 53, 17)?.id).toBe("panda");
    expect(findWordSearchTarget(question, 0, 8)).toBeUndefined();
  });

  it("rejects malformed grids, targets and accidental occurrences", () => {
    expect(
      isValidWordSearchConfiguration({
        ...question,
        grid: { rows: 5, columns: 8 },
      }),
    ).toBe(false);
    expect(
      isValidWordSearchConfiguration({ ...question, letters: question.letters.slice(1) }),
    ).toBe(false);
    expect(
      isValidWordSearchConfiguration({
        ...question,
        targets: question.targets.map((target, index) =>
          index === 0 ? { ...target, endCell: 10 } : target,
        ),
      }),
    ).toBe(false);
    expect(
      isValidWordSearchConfiguration({
        ...question,
        targets: [...question.targets, { ...question.targets[0] }],
      }),
    ).toBe(false);

    const lettersWithSecondTigre = [...question.letters];
    Array.from("TIGRE").forEach((letter, index) => {
      lettersWithSecondTigre[8 + index] = letter;
    });
    expect(isValidWordSearchConfiguration({ ...question, letters: lettersWithSecondTigre })).toBe(
      false,
    );
  });

  it("accepts Spanish accented letters and Ñ when they match the target", () => {
    const letters = [...question.letters];
    letters[1] = "Í";
    letters[35] = "Ñ";
    const targets = question.targets.map((target) =>
      target.id === "tigre"
        ? { ...target, word: "TÍGRE" }
        : target.id === "panda"
          ? { ...target, word: "PAÑDA" }
          : target,
    );
    expect(isValidWordSearchConfiguration({ ...question, letters, targets })).toBe(true);
  });

  it("validates answer IDs and calculates progress", () => {
    expect(isWordSearchAnswer({ foundWordIds: ["tigre"] })).toBe(true);
    expect(isWordSearchAnswer({ foundWordIds: [1] } as never)).toBe(false);
    expect(
      calculateWordSearchMetrics(question, { foundWordIds: ["tigre", "cebra"] }),
    ).toMatchObject({ valid: true, foundWords: 2, totalWords: 5, solved: false });
    expect(calculateWordSearchMetrics(question, { foundWordIds: ["tigre", "tigre"] }).valid).toBe(
      false,
    );
    expect(calculateWordSearchMetrics(question, { foundWordIds: ["unknown"] }).valid).toBe(false);
  });

  it("awards partial speed-adjusted credit without penalizing bad selections", () => {
    const answer = { foundWordIds: ["tigre", "cebra"] };
    expect(evaluateAnswer({ question, answer, timeUsed: 0 })).toMatchObject({
      status: "partial",
      points: 60,
    });
    expect(evaluateAnswer({ question, answer, timeUsed: 0, incorrectAttempts: 3 })).toMatchObject({
      status: "partial",
      points: 60,
      details: { type: "word-search", incorrectSelections: 3 },
    });
    expect(
      evaluateAnswer({
        question,
        answer,
        timeUsed: question.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({ status: "partial", points: 36 });
  });

  it("distinguishes a completed board from an empty timeout", () => {
    expect(
      evaluateAnswer({
        question,
        answer: { foundWordIds: question.targets.map((target) => target.id) },
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "correct", isCorrect: true, points: 150 });
    expect(
      evaluateAnswer({
        question,
        answer: { foundWordIds: [] },
        timeUsed: question.timeLimit,
        timedOut: true,
        incorrectAttempts: 2,
      }),
    ).toMatchObject({
      status: "unanswered",
      points: 0,
      details: { type: "word-search", foundWords: 0, incorrectSelections: 2 },
    });
  });
});
