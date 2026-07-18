import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { SCORING_POLICIES } from "@/features/question-formats/scoringPolicies";
import {
  calculateAnswerScore,
  calculateEstimationMetrics,
  calculateFlashMemoryMetrics,
  calculateHeatMapMetrics,
  calculateImageLabelingMetrics,
  calculateProgressiveCluesMetrics,
  calculateTotalScore,
  evaluateAnswer,
  isAnswerCorrect,
  isHeatMapAnswer,
  isValidFlashMemoryConfiguration,
  isImageLabelingAnswer,
  isValidImageLabelingConfiguration,
  QUESTION_SCORING_POLICY,
} from "@/lib/scoring";
import type { AnswerValue, QuestionType } from "@/types/game";

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
    case "ordering":
      correctAnswer = example.correctOrder;
      incorrectAnswer = [];
      incorrectPoints = -Math.round(example.points * 0.2);
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
        Math.round(question.points * 0.5),
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
      points: 65,
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
      points: 70,
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
      points: 35,
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
      points: 80,
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
      points: 50,
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
    expect(calculateAnswerScore(choice, choice.correctAnswer, choice.timeLimit)).toBe(50);
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
    ).toMatchObject({ status: "partial", points: 75 });
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
      points: 35,
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
      points: 18,
      timeUsed: question.timeLimit,
      details: { type: "flash-memory", correctPlacements: 1, totalPlacements: 4 },
    });

    const invalid = { ...question, items: [...question.items, question.items[0]] };
    expect(isValidFlashMemoryConfiguration(invalid)).toBe(false);
    expect(calculateFlashMemoryMetrics(invalid, {}).correctPlacements).toBe(0);
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
    ).toMatchObject({ status: "partial", points: 25 });
    expect(
      evaluateAnswer({ question, answer: { japon: "bandera-italia" }, timeUsed: 0 }),
    ).toMatchObject({ status: "incorrect", points: 0 });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 20, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
    });
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
      Math.round(question.points * 0.5),
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
      Math.round(choice.points * 0.5),
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
