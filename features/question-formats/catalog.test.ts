import { describe, expect, it } from "vitest";
import { challengeDefinitions } from "@/data/challengeDefinitions";
import { challenges, getChallengeById } from "@/data/challenges";
import { demoRoom } from "@/data/demoRoom";
import {
  getQuestionsByIds,
  questionGroups,
  questionsById,
  type QuestionId,
} from "@/data/questions";
import { QUESTION_FORMAT_CATALOG, questionFormats } from "@/features/question-formats/catalog";
import dictionary from "@/public/dictionaries/es-general-4.v1.json";
import { normalizeMiniWordleWord } from "@/lib/miniWordle";
import { calculateConnectPairsMetrics, isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import { isValidTimeMazeConfiguration } from "@/lib/timeMaze";
import { countZipSolutions, isValidZipConfiguration } from "@/lib/zip";
import { evaluateAnswer, isValidMemoryPairsConfiguration } from "@/lib/scoring";
import type {
  PlaceholderScheduledChallenge,
  PlayableScheduledChallenge,
  ScheduledChallenge,
} from "@/types/game";

function isPlayableScheduledChallenge(
  challenge: ScheduledChallenge,
): challenge is PlayableScheduledChallenge {
  return typeof challenge.challengeDefinitionId === "string";
}

function isPlaceholderScheduledChallenge(
  challenge: ScheduledChallenge,
): challenge is PlaceholderScheduledChallenge {
  return !isPlayableScheduledChallenge(challenge);
}

describe("question format catalog", () => {
  it("contains exactly twenty-six formats with unique slugs", () => {
    expect(questionFormats).toHaveLength(26);
    expect(new Set(questionFormats.map((format) => format.slug)).size).toBe(26);
    expect(Object.keys(QUESTION_FORMAT_CATALOG)).toEqual([
      "multiple-choice",
      "odd-one-out",
      "matching",
      "connect-pairs",
      "true-false",
      "short-text",
      "ordering",
      "classification",
      "logic-code",
      "estimation",
      "progressive-clues",
      "heat-map",
      "image-labeling",
      "flash-memory",
      "memory-pairs",
      "simon-sequence",
      "logic-matrix",
      "mini-sudoku",
      "mini-nonogram",
      "sliding-puzzle",
      "error-reconstruction",
      "anagram",
      "mini-wordle",
      "progressive-image",
      "time-maze",
      "zip",
    ]);
    expect(questionFormats.every((format) => format.examples.length > 0)).toBe(true);
    const exampleIds = questionFormats.flatMap((format) =>
      format.examples.map((example) => example.question.id),
    );
    expect(new Set(exampleIds).size).toBe(exampleIds.length);
  });

  it("keeps error-reconstruction examples internally consistent", () => {
    const examples = QUESTION_FORMAT_CATALOG["error-reconstruction"].examples;
    expect(examples).toHaveLength(2);
    for (const question of examples.map((example) => example.question)) {
      expect(question.steps.length).toBeGreaterThanOrEqual(3);
      expect(question.steps.length).toBeLessThanOrEqual(7);
      expect(question.steps.some((step) => step.id === question.firstErrorStepId)).toBe(true);
      if (question.correction) {
        expect(question.correction.options).toContain(question.correction.correctAnswer);
      }
    }
  });

  it("keeps anagram examples internally consistent", () => {
    const examples = QUESTION_FORMAT_CATALOG.anagram.examples;
    expect(examples).toHaveLength(2);
    for (const question of examples.map((example) => example.question)) {
      expect(question.tiles.length).toBeGreaterThanOrEqual(3);
      expect(question.tiles.length).toBeLessThanOrEqual(10);
      expect(question.tiles.map((tile) => tile.value).sort()).toEqual(
        Array.from(question.correctAnswer).sort(),
      );
      expect(question.tiles.map((tile) => tile.value).join("")).not.toBe(question.correctAnswer);
    }
  });

  it("keeps the Mini-Wordle example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["mini-wordle"].examples[0].question;
    expect(question.correctAnswer).toHaveLength(4);
    expect(dictionary.words).toContain(normalizeMiniWordleWord(question.correctAnswer));
    expect("additionalGuesses" in question).toBe(false);
  });

  it("keeps the progressive-image example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-image"].examples[0].question;
    expect(question.surface.src).toBe("/visuals/connections/eiffel-tower.png");
    expect(question.surface.width).toBeGreaterThan(0);
    expect(question.surface.height).toBeGreaterThan(0);
    expect(question.surface.alt).not.toContain(question.correctAnswer);
    expect(question.solutionAlt).toContain("Torre Eiffel");
    expect(question.revealDuration).toBeGreaterThan(0);
    expect(question.revealDuration).toBeLessThan(question.timeLimit);
    expect(question.acceptedAnswers).toContain(question.correctAnswer);
  });

  it("keeps the time-maze example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["time-maze"].examples[0].question;
    expect(question.grid).toEqual({ rows: 7, columns: 7 });
    expect(question.cells).toHaveLength(49);
    expect(question.cells.filter((cell) => cell === "start")).toHaveLength(1);
    expect(question.cells.filter((cell) => cell === "exit")).toHaveLength(1);
    expect(question.timeLimit).toBe(35);
    expect(isValidTimeMazeConfiguration(question)).toBe(true);
  });

  it("keeps the Zip example unique and internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG.zip.examples[0].question;
    expect(question.grid).toEqual({ rows: 5, columns: 5 });
    expect(question.solution).toHaveLength(25);
    expect(isValidZipConfiguration(question)).toBe(true);
    expect(countZipSolutions(question)).toBe(1);
  });

  it("keeps the heat-map example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["heat-map"].examples[0].question;
    expect(question.surface.src).toBe("/visuals/heat-map/spain-map.svg");
    expect(question.surface.width).toBeGreaterThan(0);
    expect(question.surface.height).toBeGreaterThan(0);
    expect(question.fullCreditRadius).toBeGreaterThan(0);
    expect(question.toleranceRadius).toBeGreaterThan(question.fullCreditRadius);
    expect(question.target.x).toBeGreaterThanOrEqual(0);
    expect(question.target.x).toBeLessThanOrEqual(1);
    expect(question.target.y).toBeGreaterThanOrEqual(0);
    expect(question.target.y).toBeLessThanOrEqual(1);
  });

  it("keeps both image-labeling examples internally consistent", () => {
    const examples = QUESTION_FORMAT_CATALOG["image-labeling"].examples;
    expect(examples).toHaveLength(2);
    expect(examples.map((example) => example.title)).toEqual([
      "Etiquetado múltiple",
      "Etiquetado único",
    ]);
    const question = examples[0].question;
    expect(question.task).toBe("assign-all");
    if (question.task !== "assign-all") throw new Error("Expected assign-all example");
    const anchorIds = question.anchors.map((anchor) => anchor.id);
    const labelIds = question.labels.map((label) => label.id);
    expect(question.surface.src).toBe("/visuals/heat-map/human-body.svg");
    expect(question.surface.width).toBeGreaterThan(0);
    expect(question.surface.height).toBeGreaterThan(0);
    expect(question.anchors).toHaveLength(5);
    expect(question.labels.length).toBeGreaterThanOrEqual(question.anchors.length);
    expect(new Set(anchorIds).size).toBe(anchorIds.length);
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(question.labels.every((label) => label.label.trim().length > 0)).toBe(true);
    expect(question.anchors.every((anchor) => labelIds.includes(anchor.correctLabelId))).toBe(true);
    expect(question.anchors.every((anchor) => anchor.point.x >= 0 && anchor.point.x <= 1)).toBe(
      true,
    );
    expect(question.anchors.every((anchor) => anchor.point.y >= 0 && anchor.point.y <= 1)).toBe(
      true,
    );

    const single = examples[1].question;
    expect(single.task).toBe("identify-one");
    if (single.task !== "identify-one") throw new Error("Expected identify-one example");
    expect(single.response.kind).toBe("choice");
    expect(single.target).toEqual({ x: 0.5, y: 0.6 });
    if (single.response.kind !== "choice") throw new Error("Expected choice response");
    expect(single.response.options).toContain(single.response.correctAnswer);
  });

  it("keeps the progressive-clues example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["progressive-clues"].examples[0].question;
    expect(question.clues.length).toBeGreaterThanOrEqual(2);
    expect(question.clues.every((clue) => clue.trim().length > 0)).toBe(true);
    expect(question.acceptedAnswers).toContain(question.correctAnswer);
    expect(question.cluePenalty).toBeGreaterThan(0);
    expect(question.cluePenalty * (question.clues.length - 1)).toBeLessThan(question.points);
  });

  it("keeps the matching example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG.matching.examples[0].question;
    const leftIds = question.leftItems.map((item) => item.id);
    const rightIds = question.rightItems.map((item) => item.id);
    expect(question.leftItems.length).toBeGreaterThanOrEqual(3);
    expect(question.leftItems.length).toBeLessThanOrEqual(6);
    expect(question.rightItems).toHaveLength(question.leftItems.length);
    expect(new Set(leftIds).size).toBe(leftIds.length);
    expect(new Set(rightIds).size).toBe(rightIds.length);
    expect(question.leftItems.every((item) => rightIds.includes(item.correctMatchId))).toBe(true);
    expect(question.leftItems.every((item) => item.label.trim().length > 0)).toBe(true);
    expect(question.rightItems.every((item) => item.label.trim().length > 0)).toBe(true);
  });

  it("keeps the memory-pairs example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["memory-pairs"].examples[0].question;
    const pairCounts = question.tiles.reduce<Record<string, number>>((counts, tile) => {
      counts[tile.pairId] = (counts[tile.pairId] ?? 0) + 1;
      return counts;
    }, {});

    expect(question.grid.rows * question.grid.columns).toBe(question.tiles.length);
    expect(Object.keys(pairCounts)).toHaveLength(4);
    expect(Object.values(pairCounts).every((count) => count === 2)).toBe(true);
    expect(new Set(question.tiles.map((tile) => tile.id)).size).toBe(question.tiles.length);
    expect(question.tiles.every((tile) => tile.label.trim().length > 0)).toBe(true);
    expect(question.tiles.every((tile) => tile.symbol && tile.symbol.trim().length > 0)).toBe(true);
    expect(isValidMemoryPairsConfiguration(question)).toBe(true);
  });

  it("keeps the connect-pairs example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["connect-pairs"].examples[0].question;
    const endpointCells = question.pairs.flatMap((pair) => pair.endpoints);
    const metrics = calculateConnectPairsMetrics(question, { paths: question.solutionPaths });

    expect(question.grid).toEqual({ rows: 5, columns: 5 });
    expect(question.pairs).toHaveLength(3);
    expect(question.requireFullCoverage).toBe(true);
    expect(new Set(question.pairs.map((pair) => pair.id)).size).toBe(question.pairs.length);
    expect(new Set(endpointCells).size).toBe(endpointCells.length);
    expect(question.pairs.every((pair) => pair.symbol.trim().length > 0)).toBe(true);
    expect(isValidConnectPairsConfiguration(question)).toBe(true);
    expect(metrics).toMatchObject({
      valid: true,
      connectedPairs: 3,
      totalPairs: 3,
      coveredCells: 25,
      totalCells: 25,
      conflicts: 0,
      exact: true,
    });
  });

  it("keeps the odd-one-out example internally consistent", () => {
    const question = QUESTION_FORMAT_CATALOG["odd-one-out"].examples[0].question;
    expect(question.items).toHaveLength(4);
    expect(question.items.length).toBeGreaterThanOrEqual(3);
    expect(question.items.length).toBeLessThanOrEqual(6);
    expect(new Set(question.items.map((item) => item.id)).size).toBe(question.items.length);
    expect(question.items.some((item) => item.id === question.correctAnswer)).toBe(true);
    expect(question.items.every((item) => item.label.trim().length > 0)).toBe(true);
  });

  it("keeps the Tabarnia mock season and playable challenges consistent", () => {
    expect(demoRoom.id).toBe("tabarnia-room");
    expect(demoRoom.title).toBe("Tabarnia");
    expect(demoRoom.activeSeason.title).toBe("Primera temporada");
    expect(demoRoom.activeSeason.status).toBe("active");
    expect(demoRoom.activeSeason.scheduledChallenges).toHaveLength(9);
    expect(demoRoom.activeSeason.scheduledChallenges.map((challenge) => challenge.id)).toEqual([
      "tabarnia-flash-01",
      "tabarnia-challenge-02",
      "tabarnia-challenge-03",
      "tabarnia-challenge-04",
      "tabarnia-challenge-05",
      "tabarnia-challenge-06",
      "tabarnia-challenge-07",
      "tabarnia-challenge-08",
      "tabarnia-challenge-09",
    ]);
    expect(
      demoRoom.activeSeason.scheduledChallenges.every(
        (challenge) => challenge.seasonId === demoRoom.activeSeason.id,
      ),
    ).toBe(true);
    expect(
      demoRoom.activeSeason.scheduledChallenges
        .filter(isPlayableScheduledChallenge)
        .every((challenge) => challenge.challengeDefinitionId in challengeDefinitions),
    ).toBe(true);
    expect(
      demoRoom.activeSeason.scheduledChallenges
        .filter(isPlaceholderScheduledChallenge)
        .every(
          (challenge) =>
            typeof challenge.title === "string" &&
            challenge.title.startsWith("Desafío ") &&
            challenge.subtitle === "Próximamente",
        ),
    ).toBe(true);
    expect(
      demoRoom.activeSeason.scheduledChallenges.map(
        (challenge) => Date.parse(challenge.availableUntil) - Date.parse(challenge.availableFrom),
      ),
    ).toEqual([
      86_399_999, 172_799_999, 259_199_999, 86_399_999, 86_399_999, 86_399_999, 86_399_999,
      86_399_999, 86_399_999,
    ]);
    expect(challenges).toHaveLength(3);
    const flashChallenge = challenges.find((challenge) => challenge.mode === "flash");
    const alphabetChallenge = challenges.find((challenge) => challenge.mode === "alphabet");
    const survivalChallenge = challenges.find((challenge) => challenge.mode === "survival");
    expect(flashChallenge?.questions).toHaveLength(16);
    expect(flashChallenge?.questions.every((question) => question.id.startsWith("sbr-"))).toBe(
      true,
    );
    expect(alphabetChallenge?.entries).toHaveLength(18);
    expect(alphabetChallenge?.timeLimit).toBe(135);
    expect(survivalChallenge?.questions).toHaveLength(20);
    expect(survivalChallenge?.lives).toBe(3);
    expect(challenges.map((challenge) => challenge.id)).toEqual([
      "tabarnia-flash-01",
      "tabarnia-challenge-02",
      "tabarnia-challenge-03",
    ]);
    expect(challenges.map((challenge) => challenge.definitionId)).toEqual([
      "demo-challenge-definition",
      "animals-alphabet-definition",
      "spain-survival-definition",
    ]);
    expect(getChallengeById("tabarnia-flash-01")?.definitionId).toBe("demo-challenge-definition");
    expect(getChallengeById("tabarnia-challenge-02")?.definitionId).toBe(
      "animals-alphabet-definition",
    );
    expect(getChallengeById("tabarnia-challenge-03")?.definitionId).toBe(
      "spain-survival-definition",
    );
    expect(flashChallenge?.questions.some((question) => question.type === "odd-one-out")).toBe(
      true,
    );
    expect(
      flashChallenge?.questions.some((question) => (question.type as string) === "image-choice"),
    ).toBe(false);

    const progressiveImageQuestion = questionsById["sbr-grand-canyon-progressive"];
    expect(
      evaluateAnswer({
        question: progressiveImageQuestion,
        answer: "gran cañon",
        timeUsed: 5,
      }).status,
    ).toBe("correct");

    expect(questionsById["sbr-west-to-east-cities"]).toMatchObject({
      directionLabels: { start: "Más al oeste", end: "Más al este" },
    });
    expect(questionsById["sbr-horse-gaits"]).toMatchObject({
      directionLabels: { start: "Más lento", end: "Más rápido" },
    });
  });

  it("keeps the mock question table consistent", () => {
    const questionIds = Object.keys(questionsById) as QuestionId[];
    expect(questionIds).toHaveLength(83);
    expect(new Set(questionIds).size).toBe(questionIds.length);
    expect(questionIds.every((id) => questionsById[id].id === id)).toBe(true);

    const sampleIds = ["capital-canada", "sequence", "eiffel-tower"] satisfies QuestionId[];
    expect(getQuestionsByIds(sampleIds).map((question) => question.id)).toEqual(sampleIds);
    expect(
      Object.values(questionGroups)
        .flat()
        .every((id) => id in questionsById),
    ).toBe(true);
  });

  it("keeps challenge definitions connected to valid questions", () => {
    const definitions = Object.values(challengeDefinitions);
    expect(definitions).toHaveLength(4);
    expect(new Set(definitions.map((definition) => definition.id)).size).toBe(definitions.length);
    expect(challengeDefinitions["demo-challenge-definition"].questionIds).toHaveLength(16);
    expect(
      challengeDefinitions["demo-challenge-definition"].questionIds.every((questionId) =>
        questionId.startsWith("sbr-"),
      ),
    ).toBe(true);
    expect(challengeDefinitions["connections-challenge-definition"].questionIds).toHaveLength(10);
    const alphabetDefinition = challengeDefinitions["animals-alphabet-definition"];
    expect(alphabetDefinition.entries).toHaveLength(18);
    expect(new Set(alphabetDefinition.entries.map((entry) => entry.letter)).size).toBe(18);
    const survivalDefinition = challengeDefinitions["spain-survival-definition"];
    expect(survivalDefinition.questionIds).toHaveLength(20);
    expect(survivalDefinition.lives).toBe(3);
    expect(Object.values(survivalDefinition.questionPoints ?? {}).reduce((a, b) => a + b, 0)).toBe(
      100,
    );
    expect(
      definitions.every((definition) =>
        (definition.mode === "alphabet"
          ? definition.entries.map((entry) => entry.questionId)
          : definition.questionIds
        ).every((questionId) => questionId in questionsById),
      ),
    ).toBe(true);
  });
});
