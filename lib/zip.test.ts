import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { evaluateAnswer } from "@/lib/scoring";
import {
  applyZipCellSelection,
  calculateZipMetrics,
  countZipSolutions,
  isCompleteZipPath,
  isValidZipConfiguration,
  isValidZipPath,
} from "@/lib/zip";

const question = QUESTION_FORMAT_CATALOG.zip.examples[0].question;

describe("Zip", () => {
  it("validates the authored unique configuration and complete solution", () => {
    expect(isValidZipConfiguration(question)).toBe(true);
    expect(countZipSolutions(question)).toBe(1);
    expect(isValidZipPath(question, question.solution)).toBe(true);
    expect(isCompleteZipPath(question, question.solution)).toBe(true);
  });

  it("rejects malformed configurations and invalid paths", () => {
    expect(isValidZipConfiguration({ ...question, grid: { rows: 4, columns: 5 } as never })).toBe(
      false,
    );
    expect(
      isValidZipConfiguration({
        ...question,
        checkpoints: question.checkpoints.map((checkpoint, index) =>
          index === 1 ? { ...checkpoint, value: 3 } : checkpoint,
        ),
      }),
    ).toBe(false);
    expect(
      isValidZipConfiguration({
        ...question,
        checkpoints: question.checkpoints.map((checkpoint, index) =>
          index === 1 ? { ...checkpoint, cell: 0 } : checkpoint,
        ),
      }),
    ).toBe(false);
    expect(isValidZipConfiguration({ ...question, solution: question.solution.slice(0, -1) })).toBe(
      false,
    );
    expect(isValidZipPath(question, [0, 2])).toBe(false);
    expect(isValidZipPath(question, [0, 1, 0])).toBe(false);
    expect(isValidZipPath(question, [0, 5])).toBe(false);
    expect(isValidZipPath(question, [...question.solution.slice(0, -2), 24])).toBe(false);
  });

  it("distinguishes ambiguous and impossible checkpoint layouts", () => {
    const ambiguous = {
      ...question,
      checkpoints: [
        { value: 1, cell: 0 },
        { value: 2, cell: 24 },
      ],
    };
    const impossible = {
      ...question,
      checkpoints: [
        { value: 1, cell: 0 },
        { value: 2, cell: 1 },
      ],
    };
    expect(countZipSolutions(ambiguous)).toBe(2);
    expect(countZipSolutions(impossible)).toBe(0);
  });

  it("extends, trims and rejects cell selections through one transition function", () => {
    expect(applyZipCellSelection(question, [0], 1)).toMatchObject({
      path: [0, 1],
      changed: true,
    });
    expect(applyZipCellSelection(question, [0], 5)).toMatchObject({
      path: [0],
      changed: false,
    });
    expect(applyZipCellSelection(question, [0, 1, 2, 3, 4, 9, 8], 9)).toMatchObject({
      path: [0, 1, 2, 3, 4, 9],
      changed: true,
    });
    expect(applyZipCellSelection(question, [0, 1], 1)).toMatchObject({
      path: [0, 1],
      changed: false,
    });
  });

  it("scores completion by speed and keeps timeout progress without points", () => {
    const complete = evaluateAnswer({
      question,
      answer: { path: question.solution },
      timeUsed: 0,
    });
    expect(complete).toMatchObject({
      status: "correct",
      isCorrect: true,
      points: 150,
      details: { type: "zip", coveredCells: 25, completed: true },
    });

    const partialPath = question.solution.slice(0, 10);
    const partial = evaluateAnswer({
      question,
      answer: { path: partialPath },
      timeUsed: question.timeLimit,
      timedOut: true,
    });
    expect(partial).toMatchObject({
      status: "partial",
      isCorrect: false,
      points: 0,
      details: { type: "zip", coveredCells: 10, reachedCheckpoint: 3, completed: false },
    });
    expect(calculateZipMetrics(question, { path: partialPath }).valid).toBe(true);

    expect(
      evaluateAnswer({
        question,
        answer: null,
        timeUsed: question.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({
      status: "unanswered",
      points: 0,
      details: { type: "zip", coveredCells: 1, reachedCheckpoint: 1 },
    });
  });
});
