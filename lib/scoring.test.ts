import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { SCORING_POLICIES } from "@/features/question-formats/scoringPolicies";
import {
  calculateAnswerScore,
  calculateEstimationMetrics,
  calculateErrorReconstructionMetrics,
  calculateFlashMemoryMetrics,
  calculateMemoryPairsMetrics,
  calculateMiniNonogramMetrics,
  calculateMiniSudokuMetrics,
  calculateMiniWordleMetrics,
  calculateHeatMapMetrics,
  calculateImageLabelingMetrics,
  calculateProgressiveCluesMetrics,
  calculateTotalScore,
  evaluateAnswer,
  isAnswerCorrect,
  isHeatMapAnswer,
  isMiniNonogramAnswer,
  isMemoryPairsAnswer,
  isMiniSudokuAnswer,
  isSlidingPuzzleAnswer,
  isSimonSequenceAnswer,
  isValidLogicMatrixConfiguration,
  isValidMiniNonogramConfiguration,
  isValidMiniSudokuConfiguration,
  isValidSlidingPuzzleConfiguration,
  isValidFlashMemoryConfiguration,
  isValidMemoryPairsConfiguration,
  isValidSimonSequenceConfiguration,
  isImageLabelingAnswer,
  isErrorReconstructionAnswer,
  isValidErrorReconstructionConfiguration,
  isValidAnagramConfiguration,
  isMiniWordleAnswer,
  isValidImageLabelingConfiguration,
  QUESTION_SCORING_POLICY,
} from "@/lib/scoring";
import {
  getMiniWordleFeedback,
  isValidMiniWordleConfiguration,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";
import {
  calculateProgressiveImageReveal,
  isValidProgressiveImageConfiguration,
} from "@/lib/progressiveImage";
import {
  applyConnectPairsCellSelection,
  calculateConnectPairsMetrics,
  isValidConnectPairsConfiguration,
} from "@/lib/connectPairs";
import {
  findShortestTimeMazePath,
  getTimeMazeExitIndex,
  getTimeMazeStartIndex,
  isValidTimeMazeConfiguration,
  isValidTimeMazePath,
} from "@/lib/timeMaze";
import type {
  AnswerValue,
  MemoryPairsAnswer,
  MiniNonogramAnswer,
  MiniWordleQuestion,
  QuestionType,
} from "@/types/game";

const formatCases = Object.values(QUESTION_FORMAT_CATALOG).map(({ examples }) => {
  const example = examples[0].question;
  let correctAnswer: AnswerValue;
  let incorrectAnswer: AnswerValue;
  let incorrectPoints: number;

  switch (example.type) {
    case "heat-map":
      correctAnswer = example.target;
      incorrectAnswer = { x: 0, y: 0 };
      incorrectPoints = 0;
      break;
    case "image-labeling":
      if (example.task === "assign-all") {
        correctAnswer = Object.fromEntries(
          example.anchors.map((anchor) => [anchor.id, anchor.correctLabelId]),
        );
        incorrectAnswer = Object.fromEntries(
          example.anchors.map((anchor, index) => [
            anchor.id,
            example.labels[(index + 1) % example.labels.length].id,
          ]),
        );
        incorrectPoints = 0;
      } else {
        correctAnswer = example.response.correctAnswer;
        incorrectAnswer = "__incorrect__";
        incorrectPoints =
          example.response.kind === "choice" ? -Math.round(example.points * 0.2) : 0;
      }
      break;
    case "matching":
      correctAnswer = Object.fromEntries(
        example.leftItems.map((item) => [item.id, item.correctMatchId]),
      );
      incorrectAnswer = {};
      incorrectPoints = 0;
      break;
    case "connect-pairs":
      correctAnswer = { paths: example.solutionPaths };
      incorrectAnswer = { paths: {} };
      incorrectPoints = 0;
      break;
    case "classification":
      correctAnswer = Object.fromEntries(
        example.items.map((item) => [item.label, item.correctCategory]),
      );
      incorrectAnswer = {};
      incorrectPoints = 0;
      break;
    case "flash-memory":
      correctAnswer = Object.fromEntries(
        example.items.map((item) => [String(item.correctPosition), item.id]),
      );
      incorrectAnswer = {};
      incorrectPoints = 0;
      break;
    case "memory-pairs": {
      const tilesByPair = example.tiles.reduce<Record<string, typeof example.tiles>>(
        (groups, tile) => {
          groups[tile.pairId] = [...(groups[tile.pairId] ?? []), tile];
          return groups;
        },
        {},
      );
      correctAnswer = {
        attempts: Object.values(tilesByPair).map((tiles) => [tiles[0].id, tiles[1].id]),
      };
      incorrectAnswer = { attempts: [] };
      incorrectPoints = 0;
      break;
    }
    case "simon-sequence":
      correctAnswer = example.sequence;
      incorrectAnswer = [...example.sequence.slice(0, 2), "__incorrect__"];
      incorrectPoints = 0;
      break;
    case "logic-matrix":
      correctAnswer = example.correctOptionId;
      incorrectAnswer = example.optionIds.find((optionId) => optionId !== example.correctOptionId)!;
      incorrectPoints = -Math.round(example.points * 0.2);
      break;
    case "mini-sudoku":
      correctAnswer = Object.fromEntries(
        example.grid.flatMap((value, index) =>
          value === null ? [[String(index), example.solution[index]]] : [],
        ),
      );
      incorrectAnswer = Object.fromEntries(
        example.grid.flatMap((value, index) =>
          value === null ? [[String(index), (example.solution[index] % 4) + 1]] : [],
        ),
      );
      incorrectPoints = 0;
      break;
    case "mini-nonogram":
      correctAnswer = Object.fromEntries(
        example.solution.flatMap((isFilled, index) => (isFilled ? [[String(index), true]] : [])),
      ) as MiniNonogramAnswer;
      incorrectAnswer = { "0": true };
      incorrectPoints = 0;
      break;
    case "sliding-puzzle":
      correctAnswer = { tiles: example.solution, moves: 2 };
      incorrectAnswer = { tiles: example.initialTiles, moves: 0 };
      incorrectPoints = 0;
      break;
    case "error-reconstruction":
      correctAnswer = {
        stepId: example.firstErrorStepId,
        ...(example.correction ? { correction: example.correction.correctAnswer } : {}),
      };
      incorrectAnswer = {
        stepId: example.steps.find((step) => step.id !== example.firstErrorStepId)!.id,
      };
      incorrectPoints = 0;
      break;
    case "anagram":
      correctAnswer = example.correctAnswer;
      incorrectAnswer = example.tiles.map((tile) => tile.value).join("");
      incorrectPoints = 0;
      break;
    case "mini-wordle":
      correctAnswer = { guesses: [example.correctAnswer] };
      incorrectAnswer = { guesses: ["CUNA", "DUNA", "RUNA", "TUNA"] };
      incorrectPoints = 0;
      break;
    case "time-maze": {
      const shortestPath = findShortestTimeMazePath(example)!;
      correctAnswer = { path: shortestPath };
      incorrectAnswer = { path: shortestPath.slice(0, -1) };
      incorrectPoints = 0;
      break;
    }
    case "ordering":
      correctAnswer = example.correctOrder;
      incorrectAnswer = [];
      incorrectPoints = 0;
      break;
    case "true-false":
      correctAnswer = example.correctAnswer;
      incorrectAnswer = !example.correctAnswer;
      incorrectPoints = -Math.round(example.points * 0.4);
      break;
    case "estimation":
      correctAnswer = example.correctAnswer;
      incorrectAnswer = example.correctAnswer + example.tolerance * 2;
      incorrectPoints = 0;
      break;
    default:
      correctAnswer = example.correctAnswer;
      incorrectAnswer = "__incorrect__";
      incorrectPoints =
        example.type === "multiple-choice" || example.type === "odd-one-out"
          ? -Math.round(example.points * 0.2)
          : 0;
  }

  return {
    type: example.type,
    question: example,
    correctAnswer,
    incorrectAnswer,
    incorrectPoints,
  };
});

describe("question evaluation", () => {
  it.each(formatCases)(
    "scores $type answers at zero time and at the time limit",
    ({ question, correctAnswer }) => {
      expect(calculateAnswerScore(question, correctAnswer, 0)).toBe(question.points);
      expect(calculateAnswerScore(question, correctAnswer, question.timeLimit)).toBe(
        Math.round(question.points * 0.6),
      );
    },
  );

  it.each(formatCases)(
    "applies the current incorrect-answer rule for $type",
    ({ question, incorrectAnswer, incorrectPoints }) => {
      expect(isAnswerCorrect(question, incorrectAnswer)).toBe(false);
      expect(calculateAnswerScore(question, incorrectAnswer, 0)).toBe(incorrectPoints);
    },
  );

  it("normalizes accepted short answers", () => {
    const question = QUESTION_FORMAT_CATALOG["short-text"].examples[0].question;
    expect(isAnswerCorrect(question, "Mil novecientos cuarenta y cinco")).toBe(true);
  });

  it("normalizes accepted progressive-clues answers", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-clues"].examples[0].question;
    expect(isAnswerCorrect(question, "  MARIE CURÍE ")).toBe(true);
    expect(isAnswerCorrect(question, "Maria Skłodowska-Curie")).toBe(true);
  });

  it("scores progressive-image recognition by speed and normalizes alternatives", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-image"].examples[0].question;

    expect(isAnswerCorrect(question, "torre eíffel")).toBe(true);
    expect(isAnswerCorrect(question, "LA TORRE EIFFEL")).toBe(true);
    expect(isAnswerCorrect(question, "Arco del Triunfo")).toBe(false);
    expect(evaluateAnswer({ question, answer: "Eiffel", timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 160,
    });
    expect(
      evaluateAnswer({ question, answer: "Torre Eiffel", timeUsed: question.timeLimit }),
    ).toMatchObject({ status: "correct", points: 96 });
    expect(evaluateAnswer({ question, answer: "Arco del Triunfo", timeUsed: 2 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: question.timeLimit,
    });

    expect(calculateProgressiveImageReveal(0, question.revealDuration)).toBe(0);
    expect(calculateProgressiveImageReveal(6, question.revealDuration)).toBe(0.5);
    expect(calculateProgressiveImageReveal(99, question.revealDuration)).toBe(1);
    expect(calculateProgressiveImageReveal(-1, question.revealDuration)).toBe(0);
  });

  it("rejects inconsistent progressive-image configurations", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-image"].examples[0].question;

    expect(isValidProgressiveImageConfiguration(question)).toBe(true);
    expect(
      isValidProgressiveImageConfiguration({
        ...question,
        surface: { ...question.surface, width: 0 },
      }),
    ).toBe(false);
    expect(
      isValidProgressiveImageConfiguration({
        ...question,
        surface: { ...question.surface, height: -1 },
      }),
    ).toBe(false);
    expect(isValidProgressiveImageConfiguration({ ...question, revealDuration: 0 })).toBe(false);
    expect(
      isValidProgressiveImageConfiguration({
        ...question,
        revealDuration: question.timeLimit,
      }),
    ).toBe(false);
    expect(isValidProgressiveImageConfiguration({ ...question, correctAnswer: " " })).toBe(false);
    expect(
      isValidProgressiveImageConfiguration({
        ...question,
        acceptedAnswers: ["Torre Eiffel", "Tórre Eiffél"],
      }),
    ).toBe(false);
    expect(
      isValidProgressiveImageConfiguration({
        ...question,
        acceptedAnswers: ["Eiffel"],
      }),
    ).toBe(false);
  });

  it("awards partial ordering points by exact position without negative penalties", () => {
    const question = {
      ...QUESTION_FORMAT_CATALOG.ordering.examples[0].question,
      points: 10,
    };

    expect(
      evaluateAnswer({
        question,
        answer: [question.correctOrder[0], question.correctOrder[1], "Internet", "Teléfono"],
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "partial", points: 5 });
    expect(
      evaluateAnswer({
        question,
        answer: [...question.correctOrder].reverse(),
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "incorrect", points: 0 });
  });

  it("finds and scores valid time-maze routes without penalizing extra moves", () => {
    const question = QUESTION_FORMAT_CATALOG["time-maze"].examples[0].question;
    const shortestPath = findShortestTimeMazePath(question)!;
    const longerPath = [
      shortestPath[0],
      shortestPath[1],
      shortestPath[0],
      ...shortestPath.slice(1),
    ];

    expect(shortestPath[0]).toBe(getTimeMazeStartIndex(question));
    expect(shortestPath.at(-1)).toBe(getTimeMazeExitIndex(question));
    expect(isValidTimeMazePath(question, shortestPath)).toBe(true);
    expect(isValidTimeMazePath(question, longerPath)).toBe(true);
    expect(isAnswerCorrect(question, { path: shortestPath })).toBe(true);
    expect(isAnswerCorrect(question, { path: longerPath })).toBe(true);

    expect(evaluateAnswer({ question, answer: { path: shortestPath }, timeUsed: 0 })).toMatchObject(
      {
        status: "correct",
        points: 150,
        details: {
          type: "time-maze",
          moves: shortestPath.length - 1,
          optimalMoves: shortestPath.length - 1,
          reachedExit: true,
        },
      },
    );
    expect(
      evaluateAnswer({ question, answer: { path: longerPath }, timeUsed: question.timeLimit }),
    ).toMatchObject({
      status: "correct",
      points: 90,
      details: { type: "time-maze", moves: longerPath.length - 1, reachedExit: true },
    });
  });

  it("rejects invalid time-maze routes and preserves partial timeout progress", () => {
    const question = QUESTION_FORMAT_CATALOG["time-maze"].examples[0].question;
    const shortestPath = findShortestTimeMazePath(question)!;
    const partialPath = shortestPath.slice(0, 6);

    expect(isValidTimeMazePath(question, [shortestPath[0], shortestPath.at(-1)!])).toBe(false);
    expect(isValidTimeMazePath(question, [shortestPath[0], 7])).toBe(false);
    expect(isValidTimeMazePath(question, shortestPath.slice(1))).toBe(false);
    expect(
      evaluateAnswer({ question, answer: { path: partialPath }, timeUsed: 99, timedOut: true }),
    ).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: question.timeLimit,
      answer: { path: partialPath },
      details: {
        type: "time-maze",
        moves: partialPath.length - 1,
        reachedExit: false,
      },
    });
  });

  it("rejects malformed or unsolvable time-maze configurations", () => {
    const question = QUESTION_FORMAT_CATALOG["time-maze"].examples[0].question;
    const replaceCell = (index: number, value: (typeof question.cells)[number]) =>
      question.cells.map((cell, cellIndex) => (cellIndex === index ? value : cell));

    expect(isValidTimeMazeConfiguration(question)).toBe(true);
    expect(isValidTimeMazeConfiguration({ ...question, grid: { rows: 4, columns: 7 } })).toBe(
      false,
    );
    expect(isValidTimeMazeConfiguration({ ...question, grid: { rows: 10, columns: 7 } })).toBe(
      false,
    );
    expect(isValidTimeMazeConfiguration({ ...question, cells: question.cells.slice(0, -1) })).toBe(
      false,
    );
    expect(
      isValidTimeMazeConfiguration({
        ...question,
        cells: replaceCell(getTimeMazeStartIndex(question), "path"),
      }),
    ).toBe(false);
    expect(
      isValidTimeMazeConfiguration({
        ...question,
        cells: replaceCell(getTimeMazeExitIndex(question), "start"),
      }),
    ).toBe(false);
    expect(
      isValidTimeMazeConfiguration({
        ...question,
        cells: Array.from({ length: 49 }, (_, index) =>
          index === 0 ? "start" : index === 48 ? "exit" : "wall",
        ),
      }),
    ).toBe(false);
  });

  it("evaluates error reconstruction with full and partial credit", () => {
    const question = QUESTION_FORMAT_CATALOG["error-reconstruction"].examples[0].question;
    if (!question.correction) throw new Error("Expected a guided correction");
    const correct = {
      stepId: question.firstErrorStepId,
      correction: question.correction.correctAnswer,
    };
    const locationOnly = { stepId: question.firstErrorStepId };

    expect(isErrorReconstructionAnswer(correct)).toBe(true);
    expect(calculateErrorReconstructionMetrics(question, correct)).toMatchObject({
      locationCorrect: true,
      correctionCorrect: true,
    });
    expect(evaluateAnswer({ question, answer: correct, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 100,
      details: { type: "error-reconstruction", locationCorrect: true, correctionCorrect: true },
    });
    expect(
      evaluateAnswer({ question, answer: locationOnly, timeUsed: question.timeLimit }),
    ).toMatchObject({
      status: "partial",
      points: 36,
      details: { type: "error-reconstruction", locationCorrect: true, correctionCorrect: false },
    });
  });

  it("rejects invalid error reconstruction configurations", () => {
    const question = QUESTION_FORMAT_CATALOG["error-reconstruction"].examples[0].question;
    expect(isValidErrorReconstructionConfiguration(question)).toBe(true);
    expect(
      isValidErrorReconstructionConfiguration({
        ...question,
        firstErrorStepId: "missing",
      }),
    ).toBe(false);
    expect(
      isValidErrorReconstructionConfiguration({
        ...question,
        correction: { ...question.correction!, options: ["Igual", " igual "] },
      }),
    ).toBe(false);
  });

  it("scores an error reconstruction draft when its time expires", () => {
    const question = QUESTION_FORMAT_CATALOG["error-reconstruction"].examples[0].question;
    expect(
      evaluateAnswer({
        question,
        answer: { stepId: question.firstErrorStepId },
        timeUsed: question.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({ status: "partial", points: 36 });
    expect(
      evaluateAnswer({ question, answer: null, timeUsed: question.timeLimit, timedOut: true }),
    ).toMatchObject({ status: "unanswered", points: 0 });
  });

  it("validates anagram tiles and accepts the exact constructed word", () => {
    const question = QUESTION_FORMAT_CATALOG.anagram.examples[1].question;
    expect(isValidAnagramConfiguration(question)).toBe(true);
    expect(isAnswerCorrect(question, "NAANA")).toBe(false);
    expect(isAnswerCorrect(question, "ANANA")).toBe(true);
    expect(evaluateAnswer({ question, answer: "ANANA", timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 120,
    });
    expect(
      isValidAnagramConfiguration({
        ...question,
        tiles: [...question.tiles.slice(0, 4), { id: "a-4", value: "B" }],
      }),
    ).toBe(false);
    expect(isValidAnagramConfiguration({ ...question, tiles: question.tiles.slice(0, 2) })).toBe(
      false,
    );
    expect(
      isValidAnagramConfiguration({
        ...question,
        tiles: [...question.tiles.slice(0, 4), { id: "n-1", value: "A" }],
      }),
    ).toBe(false);
  });

  it("does not score an incorrect or timed-out anagram", () => {
    const question = QUESTION_FORMAT_CATALOG.anagram.examples[0].question;
    expect(evaluateAnswer({ question, answer: "SAME", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
    expect(
      evaluateAnswer({ question, answer: null, timeUsed: question.timeLimit, timedOut: true }),
    ).toMatchObject({ status: "unanswered", points: 0 });
  });

  it("normalizes Mini-Wordle accents while preserving Ñ", () => {
    expect(normalizeMiniWordleWord(" ágil ")).toBe("AGIL");
    expect(normalizeMiniWordleWord("caña")).toBe("CAÑA");
    expect(normalizeMiniWordleWord("cana")).not.toBe(normalizeMiniWordleWord("caña"));
  });

  it("evaluates repeated Mini-Wordle letters without exceeding solution counts", () => {
    expect(getMiniWordleFeedback("NANA", "LUNA")).toEqual([
      { letter: "N", status: "absent" },
      { letter: "A", status: "absent" },
      { letter: "N", status: "correct" },
      { letter: "A", status: "correct" },
    ]);
  });

  it("validates Mini-Wordle configuration and answer shapes", () => {
    const question = QUESTION_FORMAT_CATALOG["mini-wordle"].examples[0].question;
    expect(isValidMiniWordleConfiguration(question)).toBe(true);
    expect(isMiniWordleAnswer({ guesses: ["CUNA"] })).toBe(true);
    expect(isMiniWordleAnswer({ guesses: [2] } as unknown as AnswerValue)).toBe(false);

    const invalidCases: MiniWordleQuestion[] = [
      { ...question, correctAnswer: "SOL" },
      { ...question, additionalGuesses: ["LUNA"] },
      { ...question, additionalGuesses: ["CANA", "cána"] },
      { ...question, additionalGuesses: ["LU-NA"] },
    ];
    expect(invalidCases.every((candidate) => !isValidMiniWordleConfiguration(candidate))).toBe(
      true,
    );
    expect(calculateMiniWordleMetrics(question, { guesses: ["CUNA", "LUNA", "DUNA"] })).toEqual({
      valid: false,
      solved: false,
      attemptsUsed: 0,
      incorrectAttempts: 0,
    });
    expect(isValidMiniWordleConfiguration({ ...question, additionalGuesses: ["XEMA"] })).toBe(true);
  });

  it("scores Mini-Wordle by speed and previous incorrect attempts", () => {
    const question = QUESTION_FORMAT_CATALOG["mini-wordle"].examples[0].question;
    expect(evaluateAnswer({ question, answer: { guesses: ["LUNA"] }, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 150,
      details: { type: "mini-wordle", attemptsUsed: 1, incorrectAttempts: 0, solved: true },
    });
    expect(
      evaluateAnswer({ question, answer: { guesses: ["CUNA", "LUNA"] }, timeUsed: 0 }),
    ).toMatchObject({ status: "correct", points: 135, details: { incorrectAttempts: 1 } });
    expect(
      evaluateAnswer({ question, answer: { guesses: ["LUNA"] }, timeUsed: question.timeLimit }),
    ).toMatchObject({ status: "correct", points: 90 });
  });

  it("ends Mini-Wordle after four failures and preserves timeout history without points", () => {
    const question = QUESTION_FORMAT_CATALOG["mini-wordle"].examples[0].question;
    const guesses = ["CUNA", "DUNA", "RUNA", "TUNA"];
    expect(evaluateAnswer({ question, answer: { guesses }, timeUsed: 20 })).toMatchObject({
      status: "incorrect",
      points: 0,
      details: { attemptsUsed: 4, incorrectAttempts: 4, solved: false },
    });
    expect(
      evaluateAnswer({
        question,
        answer: { guesses: guesses.slice(0, 2) },
        timeUsed: question.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({
      status: "unanswered",
      points: 0,
      answer: { guesses: ["CUNA", "DUNA"] },
      details: { attemptsUsed: 2, incorrectAttempts: 2, solved: false },
    });
  });

  it("reduces progressive-clues points before applying the speed multiplier", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-clues"].examples[0].question;
    expect(
      evaluateAnswer({
        question,
        answer: question.correctAnswer,
        timeUsed: 0,
        progressiveCluesRevealed: 1,
      }),
    ).toMatchObject({
      status: "correct",
      points: 160,
      details: { type: "progressive-clues", revealedClues: 1, availablePoints: 160 },
    });
    expect(
      evaluateAnswer({
        question,
        answer: question.correctAnswer,
        timeUsed: question.timeLimit,
        progressiveCluesRevealed: 2,
      }),
    ).toMatchObject({
      status: "correct",
      points: 78,
      details: { type: "progressive-clues", revealedClues: 2, availablePoints: 130 },
    });
    expect(
      evaluateAnswer({
        question,
        answer: question.correctAnswer,
        timeUsed: 0,
        progressiveCluesRevealed: question.clues.length,
      }),
    ).toMatchObject({ points: 70, details: { availablePoints: 70 } });
  });

  it("returns zero for failed or timed-out progressive-clues answers", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-clues"].examples[0].question;
    expect(
      evaluateAnswer({
        question,
        answer: "Ada Lovelace",
        timeUsed: 3,
        progressiveCluesRevealed: 2,
      }),
    ).toMatchObject({ status: "incorrect", points: 0 });
    expect(
      evaluateAnswer({
        question,
        answer: null,
        timeUsed: 99,
        timedOut: true,
        progressiveCluesRevealed: 3,
      }),
    ).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: 25,
      details: {
        type: "progressive-clues",
        revealedClues: 3,
        totalClues: 4,
        availablePoints: 100,
      },
    });
  });

  it("clamps progressive-clues metadata to the authored clue range", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-clues"].examples[0].question;
    expect(calculateProgressiveCluesMetrics(question, -10)).toEqual({
      revealedClues: 1,
      totalClues: 4,
      availablePoints: 160,
    });
    expect(calculateProgressiveCluesMetrics(question, 99)).toEqual({
      revealedClues: 4,
      totalClues: 4,
      availablePoints: 70,
    });
    expect(calculateProgressiveCluesMetrics(question, Number.NaN).revealedClues).toBe(1);
  });

  it("awards full heat-map accuracy inside the target zone", () => {
    const question = QUESTION_FORMAT_CATALOG["heat-map"].examples[0].question;
    const center = question.target;
    const nearEdge = {
      x:
        question.target.x +
        question.fullCreditRadius * (question.surface.height / question.surface.width) * 0.95,
      y: question.target.y,
    };

    expect(evaluateAnswer({ question, answer: center, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 140,
      details: { type: "heat-map", accuracy: 1 },
    });
    expect(evaluateAnswer({ question, answer: nearEdge, timeUsed: 15 })).toMatchObject({
      status: "correct",
      points: 84,
    });
  });

  it("applies linear heat-map falloff before the speed multiplier", () => {
    const question = QUESTION_FORMAT_CATALOG["heat-map"].examples[0].question;
    const midpointDistance = (question.fullCreditRadius + question.toleranceRadius) / 2;
    const shortSide = Math.min(question.surface.width, question.surface.height);
    const answer = {
      x: question.target.x,
      y: question.target.y + midpointDistance / (question.surface.height / shortSide),
    };
    const metrics = calculateHeatMapMetrics(question, answer);
    expect(metrics.distance).toBeCloseTo(midpointDistance);
    expect(metrics.accuracy).toBeCloseTo(0.5);
    expect(evaluateAnswer({ question, answer, timeUsed: 0 })).toMatchObject({
      status: "partial",
      points: 70,
    });
    expect(evaluateAnswer({ question, answer, timeUsed: question.timeLimit })).toMatchObject({
      status: "partial",
      points: 42,
    });
  });

  it("normalizes heat-map distance across different surface aspect ratios", () => {
    const base = QUESTION_FORMAT_CATALOG["heat-map"].examples[0].question;
    const landscape = {
      ...base,
      surface: { ...base.surface, width: 1000, height: 500 },
      target: { x: 0.5, y: 0.5 },
    };
    const portrait = {
      ...base,
      surface: { ...base.surface, width: 500, height: 1000 },
      target: { x: 0.5, y: 0.5 },
    };
    expect(calculateHeatMapMetrics(landscape, { x: 0.6, y: 0.5 }).distance).toBeCloseTo(0.2);
    expect(calculateHeatMapMetrics(portrait, { x: 0.5, y: 0.6 }).distance).toBeCloseTo(0.2);
  });

  it("clamps heat-map coordinates and rejects malformed answers", () => {
    const question = QUESTION_FORMAT_CATALOG["heat-map"].examples[0].question;
    expect(calculateHeatMapMetrics(question, { x: 2, y: -1 }).selectedPoint).toEqual({
      x: 1,
      y: 0,
    });
    expect(isHeatMapAnswer({ x: Number.NaN, y: 0.5 })).toBe(false);
    expect(
      evaluateAnswer({
        question,
        answer: { x: Number.NaN, y: 0.5 },
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "incorrect", points: 0 });
  });

  it("discards timed-out heat-map drafts", () => {
    const question = QUESTION_FORMAT_CATALOG["heat-map"].examples[0].question;
    expect(
      evaluateAnswer({
        question,
        answer: question.target,
        timeUsed: 0,
        timedOut: true,
      }),
    ).toMatchObject({
      status: "unanswered",
      points: 0,
    });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: 15,
    });
  });

  it("scores complete image-labeling answers by correct association and speed", () => {
    const question = QUESTION_FORMAT_CATALOG["image-labeling"].examples[0].question;
    if (question.task !== "assign-all") throw new Error("Expected assign-all example");
    const complete = Object.fromEntries(
      question.anchors.map((anchor) => [anchor.id, anchor.correctLabelId]),
    );
    const partial = { ...complete, head: "torso-label", torso: "head-label" };
    expect(evaluateAnswer({ question, answer: complete, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 160,
      details: { type: "image-labeling", correctLabels: 5, totalLabels: 5 },
    });
    expect(evaluateAnswer({ question, answer: complete, timeUsed: 25 })).toMatchObject({
      status: "correct",
      points: 96,
    });
    expect(evaluateAnswer({ question, answer: partial, timeUsed: 0 })).toMatchObject({
      status: "partial",
      points: 96,
      details: { correctLabels: 3, totalLabels: 5 },
    });
  });

  it("rejects incomplete, unknown and duplicated image-labeling associations", () => {
    const question = QUESTION_FORMAT_CATALOG["image-labeling"].examples[0].question;
    if (question.task !== "assign-all") throw new Error("Expected assign-all example");
    const incomplete = { head: "head-label" };
    const unknown = Object.fromEntries(
      question.anchors.map((anchor) => [
        anchor.id,
        anchor.id === "head" ? "unknown" : anchor.correctLabelId,
      ]),
    );
    const duplicated = Object.fromEntries(
      question.anchors.map((anchor) => [anchor.id, "head-label"]),
    );
    expect(isImageLabelingAnswer(incomplete)).toBe(true);
    expect(calculateImageLabelingMetrics(question, incomplete).valid).toBe(false);
    expect(evaluateAnswer({ question, answer: incomplete, timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
    expect(calculateImageLabelingMetrics(question, unknown).valid).toBe(false);
    expect(calculateImageLabelingMetrics(question, duplicated).valid).toBe(false);
  });

  it("discards timed-out image-labeling drafts", () => {
    const question = QUESTION_FORMAT_CATALOG["image-labeling"].examples[0].question;
    if (question.task !== "assign-all") throw new Error("Expected assign-all example");
    const complete = Object.fromEntries(
      question.anchors.map((anchor) => [anchor.id, anchor.correctLabelId]),
    );
    expect(
      evaluateAnswer({ question, answer: complete, timeUsed: 99, timedOut: true }),
    ).toMatchObject({ status: "unanswered", points: 0, timeUsed: 25 });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: 25,
    });
  });

  it("scores single image-labeling choice answers as binary-speed", () => {
    const question = QUESTION_FORMAT_CATALOG["image-labeling"].examples[1].question;
    if (question.task !== "identify-one" || question.response.kind !== "choice") {
      throw new Error("Expected identify-one choice example");
    }
    expect(evaluateAnswer({ question, answer: "Muslos", timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 100,
      details: {
        type: "image-labeling",
        task: "identify-one",
        responseKind: "choice",
      },
    });
    expect(evaluateAnswer({ question, answer: "Muslos", timeUsed: 12 })).toMatchObject({
      status: "correct",
      points: 60,
    });
    expect(evaluateAnswer({ question, answer: "Torso", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: -20,
    });
    expect(evaluateAnswer({ question, answer: 42, timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
  });

  it("normalizes single image-labeling text answers without penalizing failures", () => {
    const base = QUESTION_FORMAT_CATALOG["image-labeling"].examples[1].question;
    if (base.task !== "identify-one") throw new Error("Expected identify-one example");
    const question = {
      ...base,
      id: "guide-image-labeling-single-text",
      response: {
        kind: "text" as const,
        correctAnswer: "Músculo cuádriceps",
        acceptedAnswers: ["Músculo cuádriceps", "Cuadriceps"],
      },
    };
    expect(evaluateAnswer({ question, answer: "  CUADRÍCEPS ", timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 100,
      details: { task: "identify-one", responseKind: "text" },
    });
    expect(evaluateAnswer({ question, answer: "Gemelo", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
  });

  it("discards timed-out single image-labeling answers", () => {
    const question = QUESTION_FORMAT_CATALOG["image-labeling"].examples[1].question;
    expect(
      evaluateAnswer({ question, answer: "Muslos", timeUsed: 99, timedOut: true }),
    ).toMatchObject({ status: "unanswered", points: 0, timeUsed: 12 });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: 12,
    });
  });

  it("rejects malformed single image-labeling configurations defensively", () => {
    const base = QUESTION_FORMAT_CATALOG["image-labeling"].examples[1].question;
    if (base.task !== "identify-one" || base.response.kind !== "choice") {
      throw new Error("Expected identify-one choice example");
    }
    const missingCorrectOption = {
      ...base,
      response: { ...base.response, options: ["Cabeza", "Torso"] },
    };
    const invalidTarget = { ...base, target: { x: Number.NaN, y: 0.6 } };
    expect(isValidImageLabelingConfiguration(missingCorrectOption)).toBe(false);
    expect(isValidImageLabelingConfiguration(invalidTarget)).toBe(false);
    expect(
      evaluateAnswer({ question: missingCorrectOption, answer: "Muslos", timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: 0 });
    expect(
      evaluateAnswer({ question: invalidTarget, answer: "Muslos", timeUsed: 0 }),
    ).toMatchObject({
      status: "incorrect",
      points: 0,
    });
  });

  it("preserves the speed floor and incorrect penalties", () => {
    const choice = QUESTION_FORMAT_CATALOG["multiple-choice"].examples[0].question;
    const trueFalse = QUESTION_FORMAT_CATALOG["true-false"].examples[0].question;
    expect(calculateAnswerScore(choice, choice.correctAnswer, 0)).toBe(100);
    expect(calculateAnswerScore(choice, choice.correctAnswer, choice.timeLimit)).toBe(60);
    expect(calculateAnswerScore(choice, "Toronto", 0)).toBe(-20);
    expect(calculateAnswerScore(trueFalse, true, 0)).toBe(-40);
  });

  it("evaluates odd-one-out answers and applies its incorrect penalty", () => {
    const question = QUESTION_FORMAT_CATALOG["odd-one-out"].examples[0].question;
    expect(evaluateAnswer({ question, answer: "luna", timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 100,
    });
    expect(evaluateAnswer({ question, answer: "venus", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: -20,
    });
    expect(evaluateAnswer({ question, answer: "desconocido", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: -20,
    });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: question.timeLimit,
    });
  });

  it("awards partial classification points", () => {
    const question = QUESTION_FORMAT_CATALOG.classification.examples[0].question;
    const result = evaluateAnswer({
      question,
      answer: { Delfín: "mamífero", Águila: "ave", Tortuga: "ave" },
      timeUsed: 0,
    });
    expect(result.status).toBe("incorrect");
    expect(result.points).toBe(107);
  });

  it("awards matching credit per correct pair and adjusts it by speed", () => {
    const question = QUESTION_FORMAT_CATALOG.matching.examples[0].question;
    const complete = {
      japon: "bandera-japon",
      italia: "bandera-italia",
      francia: "bandera-francia",
    };
    expect(evaluateAnswer({ question, answer: complete, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 150,
      details: { type: "matching", correctPairs: 3, totalPairs: 3 },
    });
    expect(
      evaluateAnswer({
        question,
        answer: { japon: "bandera-japon", italia: "bandera-italia" },
        timeUsed: 10,
      }),
    ).toMatchObject({ status: "partial", points: 80 });
  });

  it("validates connect-pairs routes, endpoints, conflicts, and coverage", () => {
    const question = QUESTION_FORMAT_CATALOG["connect-pairs"].examples[0].question;
    const answer = { paths: question.solutionPaths };

    expect(isValidConnectPairsConfiguration(question)).toBe(true);
    expect(calculateConnectPairsMetrics(question, answer)).toMatchObject({
      valid: true,
      connectedPairs: 3,
      coveredCells: 25,
      conflicts: 0,
      exact: true,
    });
    expect(
      isValidConnectPairsConfiguration({
        ...question,
        pairs: [
          { ...question.pairs[0], endpoints: [0, 1] },
          { ...question.pairs[1], endpoints: [1, 24] },
          question.pairs[2],
        ],
      }),
    ).toBe(false);
    expect(
      calculateConnectPairsMetrics(question, { paths: { ...question.solutionPaths, a: [0, 6, 4] } })
        .valid,
    ).toBe(false);
    expect(
      calculateConnectPairsMetrics(question, { paths: { ...question.solutionPaths, a: [0, 2, 4] } })
        .valid,
    ).toBe(false);
    expect(
      calculateConnectPairsMetrics(question, { paths: { ...question.solutionPaths, a: [1, 2, 3] } })
        .valid,
    ).toBe(false);
    expect(
      calculateConnectPairsMetrics(question, {
        paths: { ...question.solutionPaths, c: [6, 7, 8, 9, 14, 13, 12, 17, 18, 23, 24, 19] },
      }).conflicts,
    ).toBeGreaterThan(0);
    expect(
      isValidConnectPairsConfiguration({
        ...question,
        solutionPaths: { a: question.solutionPaths.a, b: question.solutionPaths.b, c: [6, 11] },
      }),
    ).toBe(false);
    expect(calculateConnectPairsMetrics(question, { paths: { a: [0, 1, 2, 3] } })).toMatchObject({
      valid: false,
      connectedPairs: 0,
      coveredCells: 4,
    });
    expect(calculateConnectPairsMetrics(question, { paths: { a: [0, 1, 2, 3, 4] } })).toMatchObject(
      {
        valid: true,
        connectedPairs: 1,
        coveredCells: 5,
      },
    );
  });

  it("closes connect-pairs paths when tapping the final endpoint", () => {
    const question = QUESTION_FORMAT_CATALOG["connect-pairs"].examples[0].question;
    let paths: Record<string, number[]> = {};
    let activePairId = "a";

    for (const cell of question.solutionPaths.a) {
      const result = applyConnectPairsCellSelection(question, paths, activePairId, cell);
      paths = result.paths;
      activePairId = result.activePairId;
    }

    expect(paths.a).toEqual(question.solutionPaths.a);
    expect(calculateConnectPairsMetrics(question, { paths })).toMatchObject({
      connectedPairs: 1,
      coveredCells: 5,
      exact: false,
    });

    for (const cell of [...question.solutionPaths.b, ...question.solutionPaths.c]) {
      const result = applyConnectPairsCellSelection(question, paths, activePairId, cell);
      paths = result.paths;
      activePairId = result.activePairId;
    }

    expect(calculateConnectPairsMetrics(question, { paths })).toMatchObject({
      connectedPairs: 3,
      coveredCells: 25,
      exact: true,
    });
  });

  it("rejects foreign endpoints and still allows trimming connect-pairs paths", () => {
    const question = QUESTION_FORMAT_CATALOG["connect-pairs"].examples[0].question;
    const paths = { a: [0, 1, 2, 3] };
    const shortPath = { a: [0, 1, 2] };
    const foreignEndpoint = applyConnectPairsCellSelection(question, paths, "a", 5);
    const ownDistantEndpoint = applyConnectPairsCellSelection(question, shortPath, "a", 4);
    const trimmed = applyConnectPairsCellSelection(question, paths, "a", 2);

    expect(foreignEndpoint).toMatchObject({
      paths,
      activePairId: "a",
      changed: false,
    });
    expect(ownDistantEndpoint).toMatchObject({
      paths: shortPath,
      activePairId: "a",
      changed: false,
    });
    expect(trimmed).toMatchObject({
      paths: { a: [0, 1, 2] },
      activePairId: "a",
      changed: true,
    });
  });

  it("scores connect-pairs perfect, partial, invalid, and timeout answers", () => {
    const question = QUESTION_FORMAT_CATALOG["connect-pairs"].examples[0].question;
    const perfect = { paths: question.solutionPaths };
    const partial = { paths: { a: question.solutionPaths.a } };

    expect(evaluateAnswer({ question, answer: perfect, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 150,
      details: { type: "connect-pairs", connectedPairs: 3, coveredCells: 25 },
    });
    expect(
      evaluateAnswer({ question, answer: perfect, timeUsed: question.timeLimit }),
    ).toMatchObject({
      status: "correct",
      points: 90,
    });
    expect(evaluateAnswer({ question, answer: partial, timeUsed: 0 })).toMatchObject({
      status: "partial",
      points: 30,
      details: { type: "connect-pairs", connectedPairs: 1, coveredCells: 5 },
    });
    expect(
      evaluateAnswer({
        question,
        answer: partial,
        timeUsed: question.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({ status: "partial", points: 18 });
    expect(
      evaluateAnswer({ question, answer: { paths: {} }, timeUsed: 0, timedOut: true }),
    ).toMatchObject({ status: "unanswered", points: 0 });
    expect(
      evaluateAnswer({ question, answer: { paths: { a: [0, 6, 24] } }, timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: 0 });
  });

  it("awards flash-memory credit per correctly reconstructed position", () => {
    const question = QUESTION_FORMAT_CATALOG["flash-memory"].examples[0].question;
    const fullAnswer = Object.fromEntries(
      question.items.map((item) => [String(item.correctPosition), item.id]),
    );
    const partialAnswer = { "0": "mercurio", "1": "tierra", "2": "venus", "3": "marte" };

    expect(evaluateAnswer({ question, answer: fullAnswer, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 140,
      details: { type: "flash-memory", correctPlacements: 4, totalPlacements: 4 },
    });
    expect(
      evaluateAnswer({ question, answer: partialAnswer, timeUsed: question.timeLimit }),
    ).toMatchObject({
      status: "partial",
      points: 42,
      details: { type: "flash-memory", correctPlacements: 2, totalPlacements: 4 },
    });
  });

  it("preserves flash-memory progress on timeout and rejects invalid configurations", () => {
    const question = QUESTION_FORMAT_CATALOG["flash-memory"].examples[0].question;
    expect(
      evaluateAnswer({
        question,
        answer: { "0": "mercurio", "1": "tierra" },
        timeUsed: 99,
        timedOut: true,
      }),
    ).toMatchObject({
      status: "partial",
      points: 21,
      timeUsed: question.timeLimit,
      details: { type: "flash-memory", correctPlacements: 1, totalPlacements: 4 },
    });

    const invalid = { ...question, items: [...question.items, question.items[0]] };
    expect(isValidFlashMemoryConfiguration(invalid)).toBe(false);
    expect(calculateFlashMemoryMetrics(invalid, {}).correctPlacements).toBe(0);
  });

  it("validates and scores memory-pairs attempts, fallbacks, and timeouts", () => {
    const question = QUESTION_FORMAT_CATALOG["memory-pairs"].examples[0].question;
    const perfect: MemoryPairsAnswer = {
      attempts: [
        ["sol-1", "sol-2"],
        ["nube-1", "nube-2"],
        ["luna-1", "luna-2"],
        ["rayo-1", "rayo-2"],
      ],
    };
    const partialWithFailure: MemoryPairsAnswer = {
      attempts: [
        ["sol-1", "nube-1"],
        ["sol-1", "sol-2"],
      ],
    };

    expect(isMemoryPairsAnswer(perfect)).toBe(true);
    expect(isMemoryPairsAnswer({ attempts: [["sol-1"]] } as unknown as AnswerValue)).toBe(false);
    expect(isValidMemoryPairsConfiguration(question)).toBe(true);
    expect(calculateMemoryPairsMetrics(question, partialWithFailure)).toMatchObject({
      valid: true,
      matchedPairs: 1,
      totalPairs: 4,
      incorrectAttempts: 1,
      totalAttempts: 2,
    });
    expect(evaluateAnswer({ question, answer: perfect, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 140,
      details: { type: "memory-pairs", matchedPairs: 4, totalPairs: 4 },
    });
    expect(evaluateAnswer({ question, answer: partialWithFailure, timeUsed: 0 })).toMatchObject({
      status: "partial",
      points: 21,
      details: { type: "memory-pairs", matchedPairs: 1, incorrectAttempts: 1 },
    });
    expect(
      evaluateAnswer({
        question,
        answer: partialWithFailure,
        timeUsed: question.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({
      answer: partialWithFailure,
      status: "partial",
      points: 7,
      details: { type: "memory-pairs", totalAttempts: 2 },
    });
    expect(
      evaluateAnswer({ question, answer: { attempts: [] }, timeUsed: 99, timedOut: true }),
    ).toMatchObject({ status: "unanswered", points: 0, timeUsed: question.timeLimit });
    expect(
      evaluateAnswer({ question, answer: { attempts: [["sol-1", "missing"]] }, timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: 0 });
    expect(
      evaluateAnswer({ question, answer: { attempts: [["sol-1", "sol-1"]] }, timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: 0 });
  });

  it("rejects inconsistent memory-pairs configurations", () => {
    const question = QUESTION_FORMAT_CATALOG["memory-pairs"].examples[0].question;
    expect(isValidMemoryPairsConfiguration({ ...question, grid: { rows: 2, columns: 3 } })).toBe(
      false,
    );
    expect(
      isValidMemoryPairsConfiguration({
        ...question,
        tiles: question.tiles.map((tile, index) =>
          index === 1 ? { ...tile, pairId: "sol" } : tile,
        ),
      }),
    ).toBe(false);
    expect(
      isValidMemoryPairsConfiguration({
        ...question,
        tiles: [{ ...question.tiles[0] }, ...question.tiles.slice(1)],
      }),
    ).toBe(true);
    expect(
      isValidMemoryPairsConfiguration({
        ...question,
        tiles: [{ ...question.tiles[0], id: question.tiles[1].id }, ...question.tiles.slice(1)],
      }),
    ).toBe(false);
    expect(
      isValidMemoryPairsConfiguration({
        ...question,
        mismatchRevealDuration: 0,
      }),
    ).toBe(false);
  });

  it("scores an exact Simon sequence by response speed and records its divergence", () => {
    const question = QUESTION_FORMAT_CATALOG["simon-sequence"].examples[0].question;
    expect(evaluateAnswer({ question, answer: question.sequence, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 140,
      details: { type: "simon-sequence", firstMismatchIndex: null },
    });
    expect(
      evaluateAnswer({ question, answer: question.sequence, timeUsed: question.timeLimit }),
    ).toMatchObject({ status: "correct", points: 84 });
    expect(evaluateAnswer({ question, answer: ["orbita", "luna"], timeUsed: 2 })).toMatchObject({
      status: "incorrect",
      points: 0,
      details: { type: "simon-sequence", firstMismatchIndex: 1 },
    });
  });

  it("rejects malformed Simon configurations and reports a timed-out sequence", () => {
    const question = QUESTION_FORMAT_CATALOG["simon-sequence"].examples[0].question;
    expect(isSimonSequenceAnswer(question.sequence)).toBe(true);
    expect(isSimonSequenceAnswer(["orbita", 2] as AnswerValue)).toBe(false);
    expect(isValidSimonSequenceConfiguration(question)).toBe(true);
    expect(
      isValidSimonSequenceConfiguration({
        ...question,
        pads: [...question.pads, question.pads[0]],
      }),
    ).toBe(false);
    expect(isValidSimonSequenceConfiguration({ ...question, sequence: ["desconocido"] })).toBe(
      false,
    );
    expect(
      isValidSimonSequenceConfiguration({ ...question, sequence: question.sequence.slice(0, 3) }),
    ).toBe(false);
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: question.timeLimit,
      details: { type: "simon-sequence", submittedSteps: [], firstMismatchIndex: null },
    });
  });

  it("scores logic-matrix answers and rejects malformed matrix configurations", () => {
    const question = QUESTION_FORMAT_CATALOG["logic-matrix"].examples[0].question;
    expect(
      evaluateAnswer({ question, answer: question.correctOptionId, timeUsed: 0 }),
    ).toMatchObject({
      status: "correct",
      points: 130,
    });
    expect(
      evaluateAnswer({
        question,
        answer: question.correctOptionId,
        timeUsed: question.timeLimit,
      }),
    ).toMatchObject({ status: "correct", points: 78 });
    expect(evaluateAnswer({ question, answer: "circle", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: -26,
    });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: question.timeLimit,
    });

    expect(isValidLogicMatrixConfiguration(question)).toBe(true);
    expect(
      isValidLogicMatrixConfiguration({ ...question, cells: question.cells.slice(0, 8) }),
    ).toBe(false);
    expect(
      isValidLogicMatrixConfiguration({
        ...question,
        cells: question.cells.map((cell) => cell ?? "triangle"),
      }),
    ).toBe(false);
    expect(
      isValidLogicMatrixConfiguration({
        ...question,
        cells: question.cells.map((cell, index) => (index === 0 ? null : cell)),
      }),
    ).toBe(false);
    expect(
      isValidLogicMatrixConfiguration({
        ...question,
        cells: [...question.cells.slice(0, 8), "unknown"],
      }),
    ).toBe(false);
    expect(
      isValidLogicMatrixConfiguration({
        ...question,
        optionIds: ["circle", "circle", "square", "diamond"],
      }),
    ).toBe(false);
    expect(
      isValidLogicMatrixConfiguration({
        ...question,
        pieces: [...question.pieces, { id: "star", symbol: "★", label: "Estrella" }],
        correctOptionId: "star",
      }),
    ).toBe(false);
  });

  it("preserves matching progress on timeout without rewarding wrong pairs", () => {
    const question = QUESTION_FORMAT_CATALOG.matching.examples[0].question;
    expect(
      evaluateAnswer({
        question,
        answer: { japon: "bandera-japon" },
        timeUsed: 20,
        timedOut: true,
      }),
    ).toMatchObject({ status: "partial", points: 30 });
    expect(
      evaluateAnswer({ question, answer: { japon: "bandera-italia" }, timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: 0 });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 20, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
    });
  });

  it("scores mini-sudoku cells, keeps timeout drafts, and validates its solution", () => {
    const question = QUESTION_FORMAT_CATALOG["mini-sudoku"].examples[0].question;
    const completeAnswer = { "1": 2, "6": 1, "11": 3, "12": 4 };
    const partialAnswer = { "1": 2, "6": 4, "11": 3, "12": 1 };

    expect(isMiniSudokuAnswer(completeAnswer)).toBe(true);
    expect(isMiniSudokuAnswer({ "1": "2" })).toBe(false);
    expect(calculateMiniSudokuMetrics(question, completeAnswer)).toMatchObject({
      correctCells: 4,
      totalCells: 4,
      complete: true,
      valid: true,
    });
    expect(evaluateAnswer({ question, answer: completeAnswer, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 160,
      details: { type: "mini-sudoku", correctCells: 4, totalCells: 4 },
    });
    expect(
      evaluateAnswer({ question, answer: completeAnswer, timeUsed: question.timeLimit }),
    ).toMatchObject({ status: "correct", points: 96 });
    expect(
      evaluateAnswer({ question, answer: partialAnswer, timeUsed: question.timeLimit }),
    ).toMatchObject({
      status: "partial",
      points: 48,
    });
    expect(evaluateAnswer({ question, answer: { "1": 3 }, timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
    expect(
      evaluateAnswer({ question, answer: { "1": 2, "6": 4 }, timeUsed: 99, timedOut: true }),
    ).toMatchObject({
      status: "partial",
      points: 24,
      timeUsed: question.timeLimit,
      details: { type: "mini-sudoku", correctCells: 1, totalCells: 4 },
    });

    expect(isValidMiniSudokuConfiguration(question)).toBe(true);
    expect(isValidMiniSudokuConfiguration({ ...question, grid: question.grid.slice(0, 15) })).toBe(
      false,
    );
    expect(
      isValidMiniSudokuConfiguration({
        ...question,
        solution: [...question.solution.slice(0, 1), 5, ...question.solution.slice(2)],
      }),
    ).toBe(false);
    expect(isValidMiniSudokuConfiguration({ ...question, grid: question.solution })).toBe(false);
    expect(
      isValidMiniSudokuConfiguration({
        ...question,
        grid: [null, null, null, null, null, ...question.grid.slice(5)],
      }),
    ).toBe(false);
    expect(
      isValidMiniSudokuConfiguration({ ...question, grid: [2, ...question.grid.slice(1)] }),
    ).toBe(false);
    expect(
      isValidMiniSudokuConfiguration({
        ...question,
        solution: [1, 1, ...question.solution.slice(2)],
      }),
    ).toBe(false);
    expect(calculateMiniSudokuMetrics(question, { "1": 5 })).toMatchObject({
      correctCells: 0,
      valid: false,
    });
  });

  it("scores mini-nonogram net fills, preserves drafts, and validates clues", () => {
    const question = QUESTION_FORMAT_CATALOG["mini-nonogram"].examples[0].question;
    const completeAnswer = Object.fromEntries(
      question.solution.flatMap((isFilled, index) => (isFilled ? [[String(index), true]] : [])),
    ) as MiniNonogramAnswer;
    const partialAnswer: MiniNonogramAnswer = { "1": true, "2": true, "0": true };

    expect(isMiniNonogramAnswer(completeAnswer)).toBe(true);
    expect(isMiniNonogramAnswer({ "1": false } as unknown as AnswerValue)).toBe(false);
    expect(calculateMiniNonogramMetrics(question, partialAnswer)).toMatchObject({
      correctFilled: 2,
      incorrectFilled: 1,
      totalFilled: 17,
      valid: true,
    });
    expect(evaluateAnswer({ question, answer: completeAnswer, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 180,
      details: { type: "mini-nonogram", correctFilled: 17, incorrectFilled: 0, totalFilled: 17 },
    });
    expect(
      evaluateAnswer({ question, answer: completeAnswer, timeUsed: question.timeLimit }),
    ).toMatchObject({ status: "correct", points: 108 });
    expect(evaluateAnswer({ question, answer: partialAnswer, timeUsed: 0 })).toMatchObject({
      status: "partial",
      points: 11,
    });
    expect(evaluateAnswer({ question, answer: { "0": true }, timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
    expect(evaluateAnswer({ question, answer: {}, timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
    expect(
      evaluateAnswer({ question, answer: partialAnswer, timeUsed: 99, timedOut: true }),
    ).toMatchObject({
      status: "partial",
      points: 6,
      timeUsed: question.timeLimit,
      details: { type: "mini-nonogram", correctFilled: 2, incorrectFilled: 1, totalFilled: 17 },
    });

    expect(isValidMiniNonogramConfiguration(question)).toBe(true);
    expect(
      isValidMiniNonogramConfiguration({ ...question, solution: question.solution.slice(0, 24) }),
    ).toBe(false);
    expect(
      isValidMiniNonogramConfiguration({
        ...question,
        solution: [
          ...question.solution.slice(0, 1),
          1,
          ...question.solution.slice(2),
        ] as unknown as boolean[],
      }),
    ).toBe(false);
    expect(
      isValidMiniNonogramConfiguration({ ...question, rowClues: question.rowClues.slice(0, 4) }),
    ).toBe(false);
    expect(
      isValidMiniNonogramConfiguration({
        ...question,
        columnClues: [[0], ...question.columnClues.slice(1)],
      }),
    ).toBe(false);
    expect(
      isValidMiniNonogramConfiguration({
        ...question,
        rowClues: [[2], ...question.rowClues.slice(1)],
      }),
    ).toBe(false);
    expect(calculateMiniNonogramMetrics(question, { "25": true })).toMatchObject({
      correctFilled: 0,
      incorrectFilled: 0,
      valid: false,
    });
  });

  it("scores sliding-puzzle resolution and rejects invalid or unsolvable boards", () => {
    const question = QUESTION_FORMAT_CATALOG["sliding-puzzle"].examples[0].question;
    const solvedAnswer = { tiles: question.solution, moves: 2 };

    expect(isSlidingPuzzleAnswer(solvedAnswer)).toBe(true);
    expect(isSlidingPuzzleAnswer({ tiles: question.solution, moves: -1 })).toBe(false);
    expect(evaluateAnswer({ question, answer: solvedAnswer, timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 150,
      details: { type: "sliding-puzzle", moves: 2 },
    });
    expect(
      evaluateAnswer({ question, answer: solvedAnswer, timeUsed: question.timeLimit }),
    ).toMatchObject({ status: "correct", points: 90 });
    expect(
      evaluateAnswer({ question, answer: { tiles: question.initialTiles, moves: 0 }, timeUsed: 0 }),
    ).toMatchObject({
      status: "incorrect",
      points: 0,
      details: { type: "sliding-puzzle", moves: 0 },
    });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: question.timeLimit,
    });

    expect(isValidSlidingPuzzleConfiguration(question)).toBe(true);
    expect(
      isValidSlidingPuzzleConfiguration({
        ...question,
        initialTiles: question.initialTiles.slice(0, 8),
      }),
    ).toBe(false);
    expect(
      isValidSlidingPuzzleConfiguration({
        ...question,
        initialTiles: [1, 2, 3, 4, 5, 6, 7, 7, null],
      }),
    ).toBe(false);
    expect(
      isValidSlidingPuzzleConfiguration({ ...question, initialTiles: question.solution }),
    ).toBe(false);
    expect(
      isValidSlidingPuzzleConfiguration({
        ...question,
        initialTiles: [1, 2, 3, 4, 5, 6, 8, 7, null],
      }),
    ).toBe(false);
  });

  it("penalizes matching mistakes by ten percent without going below zero", () => {
    const question = QUESTION_FORMAT_CATALOG.matching.examples[0].question;
    const answer = { japon: "bandera-japon" };
    expect(
      evaluateAnswer({
        question,
        answer,
        timeUsed: 0,
        matchingIncorrectAttempts: 1,
      }),
    ).toMatchObject({
      status: "partial",
      points: 35,
      details: {
        type: "matching",
        correctPairs: 1,
        totalPairs: 3,
        incorrectAttempts: 1,
      },
    });
    expect(
      evaluateAnswer({
        question,
        answer,
        timeUsed: 0,
        matchingIncorrectAttempts: 4,
      }),
    ).toMatchObject({ status: "partial", points: 0 });
  });

  it("calculates estimation proximity", () => {
    const question = QUESTION_FORMAT_CATALOG.estimation.examples[0].question;
    const result = evaluateAnswer({ question, answer: 430, timeUsed: 0 });
    expect(result.status).toBe("partial");
    expect(result.points).toBe(70);
    expect(result.details).toEqual({ type: "estimation", difference: 100, proximity: 0.5 });
  });

  it("penalizes failed code attempts", () => {
    const question = QUESTION_FORMAT_CATALOG["logic-code"].examples[0].question;
    const result = evaluateAnswer({
      question,
      answer: "042",
      submittedCodes: ["111", "222", "042"],
      timeUsed: 0,
    });
    expect(result.points).toBe(120);
    expect(result.details).toEqual({
      type: "logic-code",
      submittedCodes: ["111", "222", "042"],
      incorrectAttempts: 2,
    });
  });

  it("returns zero points after a timeout", () => {
    const question = QUESTION_FORMAT_CATALOG["multiple-choice"].examples[0].question;
    const result = evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true });
    expect(result.status).toBe("unanswered");
    expect(result.points).toBe(0);
    expect(result.timeUsed).toBe(question.timeLimit);
  });

  it("clamps negative and excessive elapsed time", () => {
    const question = QUESTION_FORMAT_CATALOG["multiple-choice"].examples[0].question;
    expect(calculateAnswerScore(question, question.correctAnswer, -10)).toBe(question.points);
    expect(calculateAnswerScore(question, question.correctAnswer, question.timeLimit + 10)).toBe(
      Math.round(question.points * 0.6),
    );
  });

  it("floors the aggregate score at zero", () => {
    expect(calculateTotalScore([100, -20, 50])).toBe(130);
    expect(calculateTotalScore([-40, -20])).toBe(0);
  });

  it("handles non-positive scoring denominators deterministically", () => {
    const choice = {
      ...QUESTION_FORMAT_CATALOG["multiple-choice"].examples[0].question,
      timeLimit: 0,
    };
    const estimation = {
      ...QUESTION_FORMAT_CATALOG.estimation.examples[0].question,
      tolerance: 0,
    };
    const classification = {
      ...QUESTION_FORMAT_CATALOG.classification.examples[0].question,
      items: [],
    };
    const matching = {
      ...QUESTION_FORMAT_CATALOG.matching.examples[0].question,
      leftItems: [],
      rightItems: [],
    };

    expect(calculateAnswerScore(choice, choice.correctAnswer, 0)).toBe(
      Math.round(choice.points * 0.6),
    );
    expect(calculateEstimationMetrics(estimation, estimation.correctAnswer).proximity).toBe(1);
    expect(calculateEstimationMetrics(estimation, estimation.correctAnswer + 1).proximity).toBe(0);
    expect(calculateAnswerScore(classification, {}, 0)).toBe(0);
    expect(calculateAnswerScore(matching, {}, 0)).toBe(0);
  });

  it("uses the same scoring policy IDs for execution and format descriptions", () => {
    expect(Object.keys(QUESTION_SCORING_POLICY).sort()).toEqual(
      Object.keys(SCORING_POLICIES).sort(),
    );
    for (const type of Object.keys(QUESTION_SCORING_POLICY) as QuestionType[]) {
      expect(SCORING_POLICIES[type].id).toBe(QUESTION_SCORING_POLICY[type]);
    }
  });
});
