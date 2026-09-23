import { describe, expect, it } from "vitest";
import {
  displayChallenge,
  challengeWithReview,
  questionFromPayload,
  ServerFlashQuestionError,
  terminalReviewFromResponse,
} from "./serverFlashQuestionAdapter";

const serverChallenge = {
  id: "scheduled-1",
  definitionId: "definition-1",
  number: 1,
  title: "Flash de pruebas",
  subtitle: "Flash",
  description: "Desafío de prueba",
  mode: "flash" as const,
  maxScore: 100,
  slots: [
    {
      id: "item-1",
      position: 1,
      questionType: "multiple-choice" as const,
      payloadSchemaVersion: 1,
      timeLimitMs: 5_000,
      points: 50,
    },
  ],
};

describe("server flash question adapter", () => {
  it("normalizes terminal review rows returned by both SQL and mode adapters", () => {
    const snakeCase = {
      challenge_item_id: "item-snake",
      public_payload: { question: "Pregunta snake" },
      solution_payload: { correctAnswer: "A" },
    };
    const camelCase = {
      challengeItemId: "item-camel",
      publicPayload: { question: "Pregunta camel" },
      solutionPayload: { correctAnswer: "B" },
    };

    expect(terminalReviewFromResponse([snakeCase, camelCase])).toEqual([
      {
        challengeItemId: "item-snake",
        publicPayload: snakeCase.public_payload,
        solutionPayload: snakeCase.solution_payload,
      },
      {
        challengeItemId: "item-camel",
        publicPayload: camelCase.publicPayload,
        solutionPayload: camelCase.solutionPayload,
      },
    ]);
    expect(terminalReviewFromResponse([{ challenge_item_id: "incomplete" }])).toEqual([]);
  });

  it("maps a validated public payload without exposing a solution", () => {
    const question = questionFromPayload(
      "item-1",
      { question: "¿Cuál es la capital de Portugal?", options: ["Lisboa", "Oporto"] },
      5_000,
      50,
    );

    expect(question).toMatchObject({
      id: "item-1",
      type: "multiple-choice",
      question: "¿Cuál es la capital de Portugal?",
      options: ["Lisboa", "Oporto"],
      timeLimit: 5,
      points: 50,
    });
    expect(question.correctAnswer).toBe("");
  });

  it("rejects incomplete or malformed public payloads", () => {
    expect(() => questionFromPayload("item-1", { question: "Sin opciones" }, 5_000, 50)).toThrow(
      ServerFlashQuestionError,
    );
    expect(() => questionFromPayload("item-1", null, 5_000, 50)).toThrow(
      "invalid_question_payload",
    );
  });

  it("maps the final-answer formats without exposing their solutions", () => {
    const trueFalse = questionFromPayload(
      "item-true-false",
      { question: "¿La respuesta es verdadera?" },
      12_000,
      20,
      "true-false",
    );
    expect(trueFalse).toMatchObject({
      type: "true-false",
      question: "¿La respuesta es verdadera?",
    });
    expect(trueFalse).not.toHaveProperty("correctAnswer");

    const oddOneOut = questionFromPayload(
      "item-odd-one-out",
      {
        question: "¿Cuál no pertenece?",
        items: [
          { id: "horse", label: "Caballo" },
          { id: "zebra", label: "Cebra" },
          { id: "bison", label: "Bisonte" },
        ],
      },
      14_000,
      30,
      "odd-one-out",
    );
    expect(oddOneOut).toMatchObject({ type: "odd-one-out" });
    if (oddOneOut.type !== "odd-one-out") throw new Error("Expected odd-one-out");
    expect(oddOneOut.items[0]).toMatchObject({ id: "horse" });
    expect(oddOneOut).not.toHaveProperty("correctAnswer");

    const ordering = questionFromPayload(
      "item-ordering",
      {
        question: "Ordena las ciudades",
        items: ["Nueva York", "Denver", "San Diego"],
        directionLabels: { start: "Oeste", end: "Este" },
      },
      20_000,
      50,
      "ordering",
    );
    expect(ordering).toMatchObject({
      type: "ordering",
      items: ["Nueva York", "Denver", "San Diego"],
      directionLabels: { start: "Oeste", end: "Este" },
    });
    expect(ordering).not.toHaveProperty("correctOrder");

    const anagram = questionFromPayload(
      "item-anagram",
      {
        question: "Forma una palabra",
        tiles: [
          { id: "a", value: "A" },
          { id: "b", value: "B" },
          { id: "c", value: "C" },
        ],
        hint: null,
      },
      12_000,
      30,
      "anagram",
    );
    expect(anagram).toMatchObject({ type: "anagram", hint: null });
    expect(anagram).not.toHaveProperty("correctAnswer");

    const classification = questionFromPayload(
      "item-classification",
      {
        question: "Clasifica los elementos",
        items: [{ label: "Uno" }, { label: "Dos" }],
        categories: ["A", "B"],
      },
      12_000,
      30,
      "classification",
    );
    expect(classification).toMatchObject({
      type: "classification",
      items: [{ label: "Uno" }, { label: "Dos" }],
      categories: ["A", "B"],
    });
    expect(classification).not.toHaveProperty("categoriesByItem");

    const estimation = questionFromPayload(
      "item-estimation",
      {
        question: "¿Cuál es la velocidad media?",
        min: 10,
        max: 60,
        step: 1,
        initialValue: 30,
        unit: "km/h",
        media: null,
      },
      22_000,
      40,
      "estimation",
    );
    expect(estimation).toMatchObject({
      type: "estimation",
      min: 10,
      max: 60,
      step: 1,
      initialValue: 30,
      unit: "km/h",
    });
    expect(estimation).not.toHaveProperty("correctAnswer");
    expect(estimation).not.toHaveProperty("tolerance");

    const heatMap = questionFromPayload(
      "item-heat-map",
      {
        question: "Marca la ubicación",
        surface: {
          src: "https://signed.example/usa-map.png?token=test",
          alt: "Mapa sin etiquetas",
          width: 1859,
          height: 968,
          fit: "contain",
          assetId: "must-not-be-present-in-runtime",
        },
        targetLabel: "Norte de Arizona",
      },
      18_000,
      40,
      "heat-map",
    );
    expect(heatMap).toMatchObject({
      type: "heat-map",
      targetLabel: "Norte de Arizona",
      surface: { src: "https://signed.example/usa-map.png?token=test" },
    });
    expect(heatMap).not.toHaveProperty("target");
    expect(heatMap).not.toHaveProperty("fullCreditRadius");
    expect(heatMap).not.toHaveProperty("toleranceRadius");
  });

  it("reconstructs final-answer solutions only for terminal review", () => {
    const review = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-ordering",
            position: 1,
            questionType: "ordering",
            payloadSchemaVersion: 1,
            timeLimitMs: 20_000,
            points: 100,
          },
        ],
      },
      [
        {
          challengeItemId: "item-ordering",
          publicPayload: {
            question: "Ordena las ciudades",
            items: ["Nueva York", "Denver", "San Diego"],
            directionLabels: { start: "Oeste", end: "Este" },
          },
          solutionPayload: {
            correctOrder: ["San Diego", "Denver", "Nueva York"],
            explanation: "De oeste a este.",
          },
        },
      ],
    );
    expect(review.questions[0]).toMatchObject({
      type: "ordering",
      correctOrder: ["San Diego", "Denver", "Nueva York"],
    });

    const anagramReview = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-anagram",
            position: 1,
            questionType: "anagram",
            payloadSchemaVersion: 1,
            timeLimitMs: 12_000,
            points: 100,
          },
        ],
      },
      [
        {
          challengeItemId: "item-anagram",
          publicPayload: {
            question: "Forma una palabra",
            tiles: [
              { id: "a", value: "A" },
              { id: "b", value: "B" },
              { id: "c", value: "C" },
            ],
          },
          solutionPayload: { correctAnswer: "CAB", explanation: "Explicación" },
        },
      ],
    );
    expect(anagramReview.questions[0]).toMatchObject({ type: "anagram", correctAnswer: "CAB" });

    const classificationReview = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-classification",
            position: 1,
            questionType: "classification",
            payloadSchemaVersion: 1,
            timeLimitMs: 12_000,
            points: 100,
          },
        ],
      },
      [
        {
          challengeItemId: "item-classification",
          publicPayload: {
            question: "Clasifica",
            items: [{ label: "Uno" }, { label: "Dos" }],
            categories: ["A", "B"],
          },
          solutionPayload: { categoriesByItem: { Uno: "A", Dos: "B" }, explanation: "Explicación" },
        },
      ],
    );
    expect(classificationReview.questions[0]).toMatchObject({ type: "classification" });
    expect(classificationReview.questions[0].type).toBe("classification");
    if (classificationReview.questions[0].type !== "classification") {
      throw new Error("Expected classification review");
    }
    expect(classificationReview.questions[0].items[0]).toMatchObject({
      label: "Uno",
      correctCategory: "A",
    });

    const estimationReview = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-estimation",
            position: 1,
            questionType: "estimation",
            payloadSchemaVersion: 2,
            timeLimitMs: 22_000,
            points: 100,
          },
        ],
      },
      [
        {
          challengeItemId: "item-estimation",
          publicPayload: {
            question: "¿Cuál es la velocidad media?",
            min: 10,
            max: 60,
            step: 1,
            initialValue: 30,
            unit: "km/h",
            media: null,
          },
          solutionPayload: { correctAnswer: 36, tolerance: 18, explanation: "Cálculo." },
        },
      ],
    );
    expect(estimationReview.questions[0]).toMatchObject({
      type: "estimation",
      correctAnswer: 36,
      tolerance: 18,
      explanation: "Cálculo.",
    });

    const heatMapReview = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-heat-map",
            position: 1,
            questionType: "heat-map",
            payloadSchemaVersion: 2,
            timeLimitMs: 18_000,
            points: 100,
          },
        ],
      },
      [
        {
          challengeItemId: "item-heat-map",
          publicPayload: {
            question: "Marca la ubicación",
            surface: {
              src: "https://signed.example/usa-map.png",
              alt: "Mapa sin etiquetas",
              width: 1859,
              height: 968,
            },
            targetLabel: "Norte de Arizona",
          },
          solutionPayload: {
            target: { x: 0.38, y: 0.58 },
            fullCreditRadius: 0.055,
            toleranceRadius: 0.18,
            explanation: "El Gran Cañón está en Arizona.",
          },
        },
      ],
    );
    expect(heatMapReview.questions[0]).toMatchObject({
      type: "heat-map",
      target: { x: 0.38, y: 0.58 },
      fullCreditRadius: 0.055,
      toleranceRadius: 0.18,
    });
  });

  it("maps logic-matrix without its solution and restores it only in terminal review", () => {
    const publicPayload = {
      question: "Completa la matriz",
      pieces: [
        { id: "a", symbol: "A", label: "A" },
        { id: "b", symbol: "B", label: "B" },
        { id: "c", symbol: "C", label: "C" },
        { id: "d", symbol: "D", label: "D" },
      ],
      cells: ["a", "b", "c", "b", "c", "a", "c", "a", null],
      optionIds: ["d", "a", "b", "c"],
      showPieceLabels: false,
    };
    const question = questionFromPayload(
      "item-logic-matrix",
      publicPayload,
      20_000,
      100,
      "logic-matrix",
    );
    expect(question).toMatchObject({
      type: "logic-matrix",
      pieces: publicPayload.pieces,
      cells: publicPayload.cells,
      optionIds: publicPayload.optionIds,
    });
    expect(question).not.toHaveProperty("correctOptionId");

    const review = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-logic-matrix",
            position: 1,
            questionType: "logic-matrix",
            payloadSchemaVersion: 1,
            timeLimitMs: 20_000,
            points: 100,
          },
        ],
      },
      [
        {
          challengeItemId: "item-logic-matrix",
          publicPayload,
          solutionPayload: { correctOptionId: "d", explanation: "La opción D completa el patrón." },
        },
      ],
    );
    expect(review.questions[0]).toMatchObject({ type: "logic-matrix", correctOptionId: "d" });
  });

  it("maps zip without its solution and restores it only in terminal review", () => {
    const publicPayload = {
      question: "Une los números y cubre todas las celdas.",
      grid: { rows: 5, columns: 5 },
      checkpoints: [
        { value: 1, cell: 0 },
        { value: 2, cell: 4 },
        { value: 3, cell: 5 },
        { value: 4, cell: 14 },
        { value: 5, cell: 15 },
        { value: 6, cell: 24 },
      ],
    };
    const solution = [
      0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22, 23, 24,
    ];
    const question = questionFromPayload("item-zip", publicPayload, 35_000, 50, "zip");
    expect(question).toMatchObject({ type: "zip", grid: publicPayload.grid });
    expect(question).not.toHaveProperty("solution");

    const review = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-zip",
            position: 1,
            questionType: "zip",
            payloadSchemaVersion: 1,
            timeLimitMs: 35_000,
            points: 50,
          },
        ],
      },
      [
        {
          challengeItemId: "item-zip",
          publicPayload,
          solutionPayload: { solution, explanation: "Recorrido serpenteante." },
        },
      ],
    );
    expect(review.questions[0]).toMatchObject({ type: "zip", solution });
    expect(review.questions[0]).toHaveProperty("explanation", "Recorrido serpenteante.");
  });

  it("propagates a runtime-safe multiple-choice image without exposing an asset id", () => {
    const question = questionFromPayload(
      "item-1",
      {
        question: "¿Qué aparece?",
        options: ["A", "B"],
        media: {
          type: "image",
          src: "https://signed.example/question.png?token=test",
          alt: "Imagen de la pregunta",
          fit: "contain",
          position: "center",
          assetId: "must-not-be-present-in-runtime",
        },
      },
      5_000,
      50,
      "multiple-choice",
    );

    expect(question).toMatchObject({
      type: "multiple-choice",
      media: {
        type: "image",
        src: "https://signed.example/question.png?token=test",
        alt: "Imagen de la pregunta",
      },
    });
    expect(JSON.stringify(question)).not.toContain("assetId");
  });

  it("builds a renderer-safe challenge from metadata-only slots", () => {
    const challenge = displayChallenge(serverChallenge);

    expect(challenge).toMatchObject({
      id: "scheduled-1",
      mode: "flash",
      questions: [{ id: "item-1", type: "multiple-choice", options: [] }],
    });
    expect(challenge).not.toHaveProperty("slots");
  });

  it("maps Mini-Wordle progress without accepting a solution field", () => {
    const question = questionFromPayload(
      "item-mini",
      {
        category: "Lengua",
        question: "Descubre la palabra",
        hint: "Una vivienda",
        wordLength: 4,
        maxAttempts: 3,
      },
      30_000,
      50,
      "mini-wordle",
      {
        kind: "mini-wordle",
        guesses: ["SALA"],
        feedback: [[{ letter: "S", status: "absent" }]],
        attemptsUsed: 1,
        maxAttempts: 3,
      },
    );

    expect(question).toMatchObject({
      type: "mini-wordle",
      wordLength: 4,
      maxAttempts: 3,
      progress: { guesses: ["SALA"], attemptsUsed: 1 },
    });
    expect(question).not.toHaveProperty("correctAnswer");
  });

  it("maps Logic-code clues and safe progress without accepting a solution field", () => {
    const question = questionFromPayload(
      "item-code",
      {
        category: "Lógica",
        question: "Descubre el código",
        codeLength: 4,
        clues: [
          { code: "1203", hint: "El segundo dígito es el doble del primero." },
          { code: "0312", hint: "El último dígito coincide con el tercero." },
        ],
      },
      30_000,
      50,
      "logic-code",
      {
        kind: "logic-code",
        submittedCodes: ["0000", "0420"],
        incorrectAttempts: 1,
      },
    );

    expect(question).toMatchObject({
      type: "logic-code",
      codeLength: 4,
      progress: { submittedCodes: ["0000", "0420"], incorrectAttempts: 1 },
    });
    expect(question).not.toHaveProperty("correctAnswer");
  });

  it("maps only revealed Progressive-clues progress", () => {
    const question = questionFromPayload(
      "item-progressive",
      {
        category: "Historia",
        question: "Identifica el acontecimiento",
        clueCount: 3,
        cluePenalty: 25,
      },
      30_000,
      80,
      "progressive-clues",
      {
        kind: "progressive-clues",
        clues: ["Ocurrió en Europa."],
        revealedClues: 1,
        totalClues: 3,
        availablePoints: 80,
        cluePenalty: 40,
      },
    );

    expect(question).toMatchObject({
      type: "progressive-clues",
      clues: ["Ocurrió en Europa."],
      totalClues: 3,
      cluePenalty: 25,
      progress: { revealedClues: 1, availablePoints: 80 },
    });
    if (question.type !== "progressive-clues") throw new Error("Expected Progressive-clues");
    expect(question.clues).not.toContain("Pista futura");
    expect(question).not.toHaveProperty("correctAnswer");
  });

  it("maps the complete Progressive-clues payload only for review", () => {
    const question = questionFromPayload(
      "item-progressive-review",
      {
        question: "Identifica el acontecimiento",
        clues: ["Primera", "Segunda", "Tercera"],
        cluePenalty: 25,
      },
      30_000,
      50,
      "progressive-clues",
      undefined,
      true,
    );

    expect(question).toMatchObject({
      type: "progressive-clues",
      clues: ["Primera", "Segunda", "Tercera"],
      progress: { revealedClues: 3, totalClues: 3 },
    });
  });

  it("maps Matching progress without exposing a solution or future answer IDs", () => {
    const question = questionFromPayload(
      "item-matching",
      {
        category: "Cultura",
        question: "Relaciona",
        leftItems: [
          { id: "l1", label: "Uno" },
          { id: "l2", label: "Dos" },
          { id: "l3", label: "Tres" },
        ],
        rightItems: [
          { id: "r1", label: "Primero" },
          { id: "r2", label: "Segundo" },
          { id: "r3", label: "Tercero" },
        ],
      },
      30_000,
      50,
      "matching",
      {
        kind: "matching",
        matchedPairs: [{ leftId: "l1", rightId: "r1" }],
        matchedCount: 1,
        totalPairs: 3,
        incorrectAttempts: 2,
        penaltyPoints: 10,
      },
    );

    expect(question).toMatchObject({
      type: "matching",
      progress: { matchedCount: 1, incorrectAttempts: 2, penaltyPoints: 10 },
    });
    expect(question).not.toHaveProperty("correctMatchId");
    expect(question).not.toHaveProperty("solutionPayload");
    expect(JSON.stringify(question)).not.toContain("correctMatchId");
  });

  it("rejects a playable Matching payload containing correctMatchId", () => {
    expect(() =>
      questionFromPayload(
        "item-matching",
        {
          question: "Relaciona",
          leftItems: [
            { id: "l1", label: "Uno", correctMatchId: "r1" },
            { id: "l2", label: "Dos" },
            { id: "l3", label: "Tres" },
          ],
          rightItems: [
            { id: "r1", label: "Primero" },
            { id: "r2", label: "Segundo" },
            { id: "r3", label: "Tercero" },
          ],
        },
        30_000,
        50,
        "matching",
        {
          kind: "matching",
          matchedPairs: [],
          matchedCount: 0,
          totalPairs: 3,
          incorrectAttempts: 0,
          penaltyPoints: 0,
        },
      ),
    ).toThrow(ServerFlashQuestionError);
  });

  it("maps a public Progressive-image payload without its solution", () => {
    const question = questionFromPayload(
      "item-image",
      {
        question: "¿Qué monumento aparece?",
        surface: {
          src: "/visuals/connections/eiffel-tower.png",
          alt: "Imagen progresivamente revelada de un monumento europeo",
          width: 1024,
          height: 1024,
          fit: "contain",
        },
        revealDurationMs: 12_000,
        answerLabel: "¿Qué aparece?",
        answerPlaceholder: "Tu respuesta…",
      },
      20_000,
      50,
      "progressive-image",
    );

    expect(question).toMatchObject({
      type: "progressive-image",
      revealDuration: 12,
      surface: { src: "/visuals/connections/eiffel-tower.png" },
    });
    expect(question).not.toHaveProperty("correctAnswer");
    expect(question).not.toHaveProperty("solutionAlt");
  });

  it("rebuilds the complete Progressive-image question only in terminal review", () => {
    const review = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-image",
            position: 1,
            questionType: "progressive-image" as const,
            payloadSchemaVersion: 1,
            timeLimitMs: 20_000,
            points: 50,
          },
        ],
      },
      [
        {
          challengeItemId: "item-image",
          publicPayload: {
            question: "¿Qué monumento aparece?",
            surface: {
              src: "/visuals/connections/eiffel-tower.png",
              alt: "Imagen progresivamente revelada de un monumento europeo",
              width: 1024,
              height: 1024,
              fit: "contain",
            },
            revealDurationMs: 12_000,
          },
          solutionPayload: {
            correctAnswer: "Torre Eiffel",
            acceptedAnswers: ["torre eiffel", "eiffel tower"],
            solutionAlt: "La Torre Eiffel en París",
            explanation: "La imagen muestra la Torre Eiffel.",
          },
        },
      ],
    );
    expect(review.questions[0]).toMatchObject({
      type: "progressive-image",
      solutionAlt: "La Torre Eiffel en París",
      surface: { src: "/visuals/connections/eiffel-tower.png" },
    });
  });

  it("maps Escape without private reference data and restores it only in terminal review", () => {
    const publicPayload = {
      category: "Lógica espacial",
      question: "Libera la pieza amarilla.",
      grid: { rows: 6, columns: 6, exit: { side: "right" as const, row: 2 } },
      initialBlocks: [
        {
          id: "target",
          kind: "target" as const,
          orientation: "horizontal" as const,
          row: 2,
          column: 0,
          length: 2 as const,
        },
        {
          id: "a",
          kind: "obstacle" as const,
          orientation: "vertical" as const,
          row: 1,
          column: 2,
          length: 2 as const,
        },
        {
          id: "b",
          kind: "obstacle" as const,
          orientation: "vertical" as const,
          row: 0,
          column: 4,
          length: 3 as const,
        },
        {
          id: "c",
          kind: "obstacle" as const,
          orientation: "horizontal" as const,
          row: 0,
          column: 1,
          length: 2 as const,
        },
        {
          id: "d",
          kind: "obstacle" as const,
          orientation: "horizontal" as const,
          row: 4,
          column: 1,
          length: 2 as const,
        },
      ],
    };
    const referenceSolution = [
      { blockId: "c", from: 1, to: 0 },
      { blockId: "a", from: 1, to: 0 },
      { blockId: "b", from: 0, to: 3 },
      { blockId: "target", from: 0, to: 4 },
    ];
    const question = questionFromPayload("item-escape", publicPayload, 30_000, 50, "escape");
    expect(question).toMatchObject({ type: "escape", grid: publicPayload.grid });
    expect(question).not.toHaveProperty("referenceSolution");
    expect(question).not.toHaveProperty("optimalMoves");
    expect(() =>
      questionFromPayload(
        "item-escape",
        { ...publicPayload, referenceSolution },
        30_000,
        50,
        "escape",
      ),
    ).toThrow(ServerFlashQuestionError);

    const review = challengeWithReview(
      {
        ...serverChallenge,
        slots: [
          {
            id: "item-escape",
            position: 1,
            questionType: "escape" as const,
            payloadSchemaVersion: 1,
            timeLimitMs: 30_000,
            points: 50,
          },
        ],
      },
      [
        {
          challengeItemId: "item-escape",
          publicPayload,
          solutionPayload: { referenceSolution, optimalMoves: 4 },
        },
      ],
    );
    expect(review.questions[0]).toMatchObject({ type: "escape", optimalMoves: 4 });
  });
});
