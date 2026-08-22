import { describe, expect, it } from "vitest";
import { challengeDefinitions } from "@/data/challengeDefinitions";
import {
  getChallengeById,
  getPyramidQuestionIds,
  validatePyramidChallengeDefinition,
} from "@/data/challenges";
import { questionsById } from "@/data/questions";
import { withPyramidScoring } from "@/lib/challengeScoring";
import { getChallengeAvailabilityStatus } from "@/lib/challengeAvailability";
import { calculateConnectPairsMetrics, isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import { evaluateAnswer, isValidLogicMatrixConfiguration } from "@/lib/scoring";
import { countQueensSolutions, isValidQueensConfiguration } from "@/lib/queens";
import { normalizePyramidResult } from "@/features/pyramid/pyramidAttempt";

describe("La Pirámide: Cumbre lógica", () => {
  it("defines seven unique levels worth exactly 100 points", () => {
    const definition = challengeDefinitions["pyramid-logic-definition"];
    expect(() => validatePyramidChallengeDefinition(definition)).not.toThrow();
    expect(definition.levels).toHaveLength(7);
    expect(new Set(getPyramidQuestionIds(definition))).toHaveProperty("size", 7);
    expect(
      definition.levels.every(
        (level) =>
          level.briefing.title.trim().length > 0 &&
          level.briefing.format.trim().length > 0 &&
          level.briefing.description.trim().length > 0,
      ),
    ).toBe(true);
    expect(Object.values(definition.questionPoints).reduce((sum, points) => sum + points, 0)).toBe(
      100,
    );
  });

  it("resolves the published challenge and applies its increasing point values", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    expect(withPyramidScoring(challenge).levels.map((level) => level.question.points)).toEqual([
      7, 9, 11, 14, 16, 19, 24,
    ]);
    expect(withPyramidScoring(challenge).levels.map((level) => level.briefing.format)).toEqual([
      "Encontrar el intruso",
      "Secuencia numérica",
      "Ordenación lógica",
      "Matriz visual",
      "Conectar parejas",
      "Código secreto",
      "Queens",
    ]);
  });

  it("keeps the advanced puzzle configurations valid", () => {
    const matrix = questionsById["pyramid-shape-direction-matrix"];
    const trap = questionsById["pyramid-connect-pairs-trap"];
    const code = questionsById["pyramid-secret-code"];
    const queens = questionsById["pyramid-summit-queens"];
    expect(isValidLogicMatrixConfiguration(matrix)).toBe(true);
    expect(matrix.showPieceLabels).toBe(false);
    expect(trap.pairs).toHaveLength(4);
    expect(new Set(trap.pairs.flatMap((pair) => pair.endpoints))).toHaveProperty("size", 8);
    expect(isValidConnectPairsConfiguration(trap)).toBe(true);
    expect(calculateConnectPairsMetrics(trap, { paths: trap.solutionPaths })).toMatchObject({
      connectedPairs: 4,
      coveredCells: 25,
      conflicts: 0,
      exact: true,
    });
    expect(code.correctAnswer).toBe("507");
    expect(queens.prefilledQueens).toEqual([2]);
    expect(queens.solution).toEqual(expect.arrayContaining(queens.prefilledQueens ?? []));
    expect(isValidQueensConfiguration(queens)).toBe(true);
    expect(countQueensSolutions(queens)).toBe(1);
  });

  it("ends the ascent on a partial trap submission and passes only complete coverage", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    const trap = withPyramidScoring(challenge).levels[4]?.question;
    if (trap?.type !== "connect-pairs") throw new Error("Expected connect-pairs trap");

    const complete = evaluateAnswer({
      question: trap,
      answer: { paths: trap.solutionPaths },
      timeUsed: 5,
    });
    const partial = evaluateAnswer({
      question: trap,
      answer: { paths: { circle: trap.solutionPaths.circle } },
      timeUsed: 5,
    });
    const timedOut = evaluateAnswer({
      question: trap,
      answer: { paths: { circle: trap.solutionPaths.circle } },
      timeUsed: trap.timeLimit,
      timedOut: true,
    });

    expect(complete).toMatchObject({ status: "correct", isCorrect: true });
    expect(partial).toMatchObject({ status: "partial", isCorrect: false });
    expect(timedOut).toMatchObject({ status: "partial", isCorrect: false });
    expect(normalizePyramidResult(partial).points).toBe(0);
    expect(normalizePyramidResult(timedOut).points).toBe(0);
  });
});

describe("La Pirámide: Biblia y religiones abrahámicas", () => {
  it("defines seven unique levels worth exactly 100 points", () => {
    const definition = challengeDefinitions["pyramid-abrahamic-definition"];
    expect(() => validatePyramidChallengeDefinition(definition)).not.toThrow();
    expect(definition.attemptVersion).toBe(1);
    expect(getPyramidQuestionIds(definition)).toEqual([
      "abrahamic-matching-biblical-associations",
      "abrahamic-progressive-abraham",
      "abrahamic-order-torah-books",
      "abrahamic-mini-wordle-josue",
      "abrahamic-word-search-biblical-characters",
      "abrahamic-classification-three-traditions",
      "abrahamic-word-hashtag-references",
    ]);
    expect(Object.values(definition.questionPoints).reduce((sum, points) => sum + points, 0)).toBe(
      100,
    );
  });

  it("resolves the scheduled challenge with increasing point values and the expected formats", () => {
    const challenge = getChallengeById("tabarnia-challenge-06");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const scored = withPyramidScoring(challenge);
    expect(scored.levels.map((level) => level.question.points)).toEqual([7, 9, 11, 14, 16, 19, 24]);
    expect(scored.levels.map((level) => level.question.type)).toEqual([
      "matching",
      "progressive-clues",
      "ordering",
      "mini-wordle",
      "word-search",
      "classification",
      "word-hashtag",
    ]);
  });

  it("accepts the authored answers and stops on partial word search or classification", () => {
    const challenge = getChallengeById("tabarnia-challenge-06");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    const levels = withPyramidScoring(challenge).levels;
    const matching = levels[0]?.question;
    const clues = levels[1]?.question;
    const ordering = levels[2]?.question;
    const wordle = levels[3]?.question;
    const wordSearch = levels[4]?.question;
    const classification = levels[5]?.question;
    if (
      matching?.type !== "matching" ||
      clues?.type !== "progressive-clues" ||
      ordering?.type !== "ordering" ||
      wordle?.type !== "mini-wordle" ||
      wordSearch?.type !== "word-search" ||
      classification?.type !== "classification"
    ) {
      throw new Error("Unexpected Abrahamic pyramid question types");
    }

    expect(classification.items.map((item) => item.label)).toEqual([
      "Torá",
      "Evangelios",
      "Pésaj",
      "Corán",
      "Cruz",
      "Ramadán",
      "Menorá",
      "Navidad",
      "Kaaba",
    ]);

    expect(matching.rightItems.map((item) => item.id)).toEqual([
      "goliat",
      "arca",
      "nazaret",
      "exodo",
    ]);
    expect(
      matching.rightItems.every(
        (item, index) => item.id !== matching.leftItems[index]?.correctMatchId,
      ),
    ).toBe(true);

    expect(
      evaluateAnswer({
        question: matching,
        answer: { noe: "arca", moises: "exodo", david: "goliat", jesus: "nazaret" },
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "correct", isCorrect: true });
    expect(evaluateAnswer({ question: clues, answer: "Abraham", timeUsed: 0 })).toMatchObject({
      status: "correct",
      isCorrect: true,
    });
    expect(evaluateAnswer({ question: clues, answer: "Ibrahim", timeUsed: 0 })).toMatchObject({
      status: "correct",
      isCorrect: true,
    });
    expect(
      evaluateAnswer({ question: ordering, answer: ordering.correctOrder, timeUsed: 0 }),
    ).toMatchObject({
      status: "correct",
      isCorrect: true,
    });
    expect(
      evaluateAnswer({
        question: wordle,
        answer: { guesses: ["ANGEL", "ALTAR", "AYUNO", "BABEL", "BELEN", "JOSUE"] },
        timeUsed: 0,
      }),
    ).toMatchObject({ status: "correct", isCorrect: true });

    const partialSearch = evaluateAnswer({
      question: wordSearch,
      answer: { foundWordIds: ["isaac"] },
      timeUsed: 0,
    });
    const partialClassification = evaluateAnswer({
      question: classification,
      answer: { Torá: "Judaísmo" },
      timeUsed: 0,
    });
    expect(partialSearch).toMatchObject({ status: "partial", isCorrect: false });
    expect(partialClassification).toMatchObject({ status: "partial", isCorrect: false });
    expect(normalizePyramidResult(partialSearch).points).toBe(0);
    expect(normalizePyramidResult(partialClassification).points).toBe(0);
  });

  it("uses the scheduled availability window", () => {
    const challenge = getChallengeById("tabarnia-challenge-06");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    expect(
      getChallengeAvailabilityStatus(
        challenge.availableFrom,
        challenge.availableUntil,
        new Date("2026-08-25T21:59:59.999Z"),
      ),
    ).toBe("locked");
    expect(
      getChallengeAvailabilityStatus(
        challenge.availableFrom,
        challenge.availableUntil,
        new Date("2026-08-26T10:00:00.000Z"),
      ),
    ).toBe("available");
    expect(
      getChallengeAvailabilityStatus(
        challenge.availableFrom,
        challenge.availableUntil,
        new Date("2026-08-26T22:00:00.000Z"),
      ),
    ).toBe("expired");
  });
});
