import { describe, expect, it } from "vitest";
import { mockChallengeDefinitions as challengeDefinitions } from "@/test-utils/mockGameplay";
import {
  getPyramidQuestionIds,
  validatePyramidChallengeDefinition,
} from "@/test-utils/mockGameplay";
import { createMockLocalPyramidDefinition } from "@/infrastructure/mock/localPyramidDefinition";
import { scheduledChallengeRouteAliases } from "@/data/mock/constants";
import { compileDefinition } from "@/features/game/session/providers/localShared/definition";
import { mockQuestionsById as questionsById } from "@/test-utils/mockGameplay";
import { publishedChallengeFixtures } from "@/data/mock/catalog/challenges";
import { getChallengeAvailabilityStatus } from "@/lib/challengeAvailability";
import { calculateConnectPairsMetrics, isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import { evaluateAnswer, isValidLogicMatrixConfiguration } from "@/lib/scoring";
import { countQueensSolutions, isValidQueensConfiguration } from "@/lib/queens";
import { normalizePyramidResult } from "@/lib/gameplay/pyramidProgress";

function canonicalPyramid(routeId: "tabarnia-challenge-05" | "tabarnia-challenge-06") {
  const { definition, levels } = compileDefinition(
    createMockLocalPyramidDefinition(scheduledChallengeRouteAliases[routeId]),
  );
  return {
    ...definition.challenge,
    levels: definition.challenge.levels.map((level, index) => ({
      ...level,
      question: levels[index]!.question,
    })),
  };
}

describe("Cumbre lógica", () => {
  it("defines seven unique levels worth exactly 100 points", () => {
    const definition = challengeDefinitions["pyramid-logic-definition"];
    expect(() => validatePyramidChallengeDefinition(definition)).not.toThrow();
    expect(
      publishedChallengeFixtures.find((fixture) => fixture.slug === "pyramid-logic-definition")
        ?.modeConfig,
    ).toMatchObject({ attemptSchemaVersion: 2 });
    expect(
      publishedChallengeFixtures.find((fixture) => fixture.slug === "pyramid-logic-definition")
        ?.items[4],
    ).toMatchObject({ questionSlug: "pyramid-summit-queens", points: 15 });
    expect(
      publishedChallengeFixtures.find((fixture) => fixture.slug === "pyramid-logic-definition")
        ?.items[6],
    ).toMatchObject({ questionSlug: "pyramid-connect-pairs-spiral", points: 15 });
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

  it("resolves the published challenge and applies its configured point progression", () => {
    const challenge = canonicalPyramid("tabarnia-challenge-05");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    expect(challenge.levels.map((level) => level.question.points)).toEqual([
      13, 14, 14, 14, 15, 15, 15,
    ]);
    expect(challenge.levels[4]?.question).toMatchObject({
      type: "queens",
      points: 15,
      timeLimit: 30,
    });
    expect(challenge.levels[6]?.question).toMatchObject({
      type: "connect-pairs",
      points: 15,
      timeLimit: 20,
      grid: { rows: 6, columns: 6 },
    });
    expect(challenge.levels.map((level) => level.timeLimitMs)).toEqual([
      25000, 25000, 35000, 35000, 30000, 45000, 20000,
    ]);
    expect(challenge.levels.map((level) => level.question.timeLimit)).toEqual([
      25, 25, 35, 35, 30, 45, 20,
    ]);
    expect(challenge.levels.map((level) => level.briefing.format)).toEqual([
      "Encontrar el intruso",
      "Secuencia numérica",
      "Matriz visual",
      "Ordenación lógica",
      "Queens",
      "Código secreto",
      "Conectar parejas",
    ]);
  });

  it("keeps level names, formats and introductions in ascent order", () => {
    const challenge = canonicalPyramid("tabarnia-challenge-05");
    expect(challenge.levels.map((level) => [level.label, level.question.type])).toEqual([
      ["Entrada", "odd-one-out"],
      ["Patrón", "multiple-choice"],
      ["Cámara", "logic-matrix"],
      ["Orden", "ordering"],
      ["Coronas", "queens"],
      ["Cerradura", "logic-code"],
      ["Cima", "connect-pairs"],
    ]);
    expect(challenge.levels[4]?.briefing).toEqual({
      title: "Coloca las coronas",
      format: "Queens",
      description: "Coloca cinco coronas sin repetir fila, columna o región y sin que se toquen.",
    });
    expect(challenge.levels[6]?.briefing).toEqual({
      title: "Conquista la cima",
      format: "Conectar parejas",
      description:
        "Une las seis parejas con rutas ortogonales y cubre las 36 casillas para conquistar la cima.",
    });
  });

  it("keeps the advanced puzzle configurations valid", () => {
    const matrix = questionsById["pyramid-shape-direction-matrix"];
    const trap = questionsById["pyramid-connect-pairs-trap"];
    const spiral = questionsById["pyramid-connect-pairs-spiral"];
    const code = questionsById["pyramid-secret-code"];
    const queens = questionsById["pyramid-summit-queens"];
    const miniWordle = questionsById["abrahamic-mini-wordle-josue"];
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
    expect(spiral.grid).toEqual({ rows: 6, columns: 6 });
    expect(spiral.pairs.map((pair) => pair.symbol)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(spiral.pairs.map((pair) => pair.color)).toEqual([
      "#0825fa",
      "#107f12",
      "#2cfefe",
      "#fc0e1c",
      "#fb7f23",
      "#eded33",
    ]);
    expect(spiral.pairs).toHaveLength(6);
    expect(isValidConnectPairsConfiguration(spiral)).toBe(true);
    expect(calculateConnectPairsMetrics(spiral, { paths: spiral.solutionPaths })).toMatchObject({
      connectedPairs: 6,
      totalPairs: 6,
      coveredCells: 36,
      totalCells: 36,
      conflicts: 0,
      exact: true,
    });
    expect(code.correctAnswer).toBe("507");
    expect(miniWordle.additionalGuesses).toEqual(
      expect.arrayContaining(["AARON", "CALEB", "ELIAS", "JACOB", "TAMAR", "YUSUF"]),
    );
    expect(queens.prefilledQueens).toEqual([2]);
    expect(queens.solution).toEqual(expect.arrayContaining(queens.prefilledQueens ?? []));
    expect(isValidQueensConfiguration(queens)).toBe(true);
    expect(countQueensSolutions(queens)).toBe(1);
  });

  it("ends the ascent on a partial spiral submission and passes only complete coverage", () => {
    const challenge = canonicalPyramid("tabarnia-challenge-05");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    const spiral = challenge.levels[6]?.question;
    if (spiral?.type !== "connect-pairs") throw new Error("Expected connect-pairs spiral");

    const complete = evaluateAnswer({
      question: spiral,
      answer: { paths: spiral.solutionPaths },
      timeUsed: 5,
    });
    const partial = evaluateAnswer({
      question: spiral,
      answer: { paths: { a: spiral.solutionPaths.a } },
      timeUsed: 5,
    });
    const timedOut = evaluateAnswer({
      question: spiral,
      answer: { paths: { a: spiral.solutionPaths.a } },
      timeUsed: spiral.timeLimit,
      timedOut: true,
    });

    expect(complete).toMatchObject({ status: "correct", isCorrect: true });
    expect(partial).toMatchObject({ status: "partial", isCorrect: false });
    expect(timedOut).toMatchObject({ status: "partial", isCorrect: false });
    expect(normalizePyramidResult(partial).points).toBe(0);
    expect(normalizePyramidResult(timedOut).points).toBe(0);
  });
});

describe("La Biblia", () => {
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

  it("resolves the scheduled challenge with the Cumbre lógica point progression and expected formats", () => {
    const challenge = canonicalPyramid("tabarnia-challenge-06");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const scored = challenge;
    expect(scored.levels.map((level) => level.question.points)).toEqual([
      13, 14, 14, 14, 15, 15, 15,
    ]);
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
    const challenge = canonicalPyramid("tabarnia-challenge-06");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    const levels = challenge.levels;
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
    const solvedSearchAfterMiss = evaluateAnswer({
      question: wordSearch,
      answer: { foundWordIds: wordSearch.targets.map((target) => target.id) },
      timeUsed: 10,
      incorrectAttempts: 1,
    });
    const partialClassification = evaluateAnswer({
      question: classification,
      answer: { Torá: "Judaísmo" },
      timeUsed: 0,
    });
    expect(partialSearch).toMatchObject({ status: "partial", isCorrect: false });
    expect(partialClassification).toMatchObject({ status: "partial", isCorrect: false });
    expect(solvedSearchAfterMiss).toMatchObject({ status: "correct", isCorrect: true });
    expect(normalizePyramidResult(solvedSearchAfterMiss).points).toBeGreaterThan(0);
    expect(normalizePyramidResult(partialSearch).points).toBe(0);
    expect(normalizePyramidResult(partialClassification).points).toBe(0);
  });

  it("uses the scheduled availability window", () => {
    const challenge = canonicalPyramid("tabarnia-challenge-06");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    expect(
      getChallengeAvailabilityStatus(
        challenge.availableFrom,
        challenge.availableUntil,
        new Date("2026-09-05T21:59:59.999Z"),
      ),
    ).toBe("locked");
    expect(
      getChallengeAvailabilityStatus(
        challenge.availableFrom,
        challenge.availableUntil,
        new Date("2026-09-10T10:00:00.000Z"),
      ),
    ).toBe("available");
    expect(
      getChallengeAvailabilityStatus(
        challenge.availableFrom,
        challenge.availableUntil,
        new Date("2026-09-20T22:00:00.000Z"),
      ),
    ).toBe("expired");
  });
});
