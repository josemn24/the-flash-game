import { describe, expect, it } from "vitest";
import {
  FlashEditorialValidationError,
  isFlashEditorialDocument,
  parseFlashEditorialQuestionDocument,
  parseFlashEditorialDocument,
  parseFlashEditorialJson,
} from "./flashDocument";
import type {
  FlashEditorialChallengeQuestion,
  FlashEditorialQuestion,
} from "@/types/view-models/editorial";

function inlineQuestion(question: FlashEditorialChallengeQuestion): FlashEditorialQuestion {
  if ("source" in question) throw new Error("Expected inline question");
  return question;
}

type TestQuestion = {
  slug: string;
  type: string;
  payloadSchemaVersion: number;
  timeLimitMs: number;
  points: number;
  publicPayload: Record<string, unknown>;
  solutionPayload: Record<string, unknown>;
};

function documentFixture(): {
  challenge: Record<string, unknown>;
  questions: TestQuestion[];
} {
  return {
    challenge: {
      slug: "flash-editorial-test",
      title: "Flash de prueba",
      subtitle: "Dos preguntas",
      description: "Contenido de prueba",
      mode: "flash",
      configSchemaVersion: 1,
      modeConfig: {},
    },
    questions: [1, 2].map((number) => ({
      slug: `question-${number}`,
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Test",
        tags: {},
        question: `¿Pregunta ${number}?`,
        options: ["A", "B"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: { correctAnswer: "A", explanation: "A" },
    })),
  };
}

describe("Flash editorial document", () => {
  it("accepts a standalone question without challenge points", () => {
    const standalone = { ...documentFixture().questions[0] } as Record<string, unknown>;
    delete standalone.points;
    const parsed = parseFlashEditorialQuestionDocument(standalone);
    expect(parsed).not.toHaveProperty("points");
    expect(parsed.slug).toBe("question-1");
  });

  it("accepts published-library references and rejects duplicates", () => {
    const document = documentFixture();
    const reference = {
      source: "library",
      questionVersionId: "00000000-0000-4000-8000-000000000099",
      points: 50,
      modeConfig: {},
    };
    document.questions = [
      reference,
      { ...reference, questionVersionId: "00000000-0000-4000-8000-000000000100" },
    ] as unknown as TestQuestion[];
    expect(parseFlashEditorialDocument(document).questions[0]).toMatchObject(reference);
    document.questions[1] = reference as unknown as TestQuestion;
    expect(() => parseFlashEditorialDocument(document)).toThrow("no puede repetirse");
  });

  it("accepts the supported envelope and preserves both private solutions", () => {
    const parsed = parseFlashEditorialDocument(documentFixture());

    expect(parsed.questions).toHaveLength(2);
    const solution = inlineQuestion(parsed.questions[0]).solutionPayload;
    expect("correctAnswer" in solution ? solution.correctAnswer : undefined).toBe("A");
    expect(isFlashEditorialDocument(parsed)).toBe(true);
  });

  it("accepts the supported final-answer editorial formats", () => {
    const documents = [
      {
        slug: "true-false-question",
        type: "true-false",
        payloadSchemaVersion: 1,
        timeLimitMs: 12_000,
        publicPayload: { category: "Lógica", tags: {}, question: "¿Es correcto?" },
        solutionPayload: { correctAnswer: false, explanation: "No es correcto." },
      },
      {
        slug: "odd-one-out-question",
        type: "odd-one-out",
        payloadSchemaVersion: 1,
        timeLimitMs: 14_000,
        publicPayload: {
          category: "Ciencias",
          tags: {},
          question: "¿Cuál no pertenece?",
          items: [
            { id: "horse", label: "Caballo" },
            { id: "zebra", label: "Cebra" },
            { id: "bison", label: "Bisonte" },
          ],
        },
        solutionPayload: { correctAnswer: "bison", explanation: "El bisonte es un bóvido." },
      },
      {
        slug: "ordering-question",
        type: "ordering",
        payloadSchemaVersion: 1,
        timeLimitMs: 20_000,
        publicPayload: {
          category: "Geografía",
          tags: {},
          question: "Ordena de oeste a este.",
          items: ["Nueva York", "Denver", "San Diego"],
          directionLabels: { start: "Más al oeste", end: "Más al este" },
        },
        solutionPayload: {
          correctOrder: ["San Diego", "Denver", "Nueva York"],
          explanation: "Orden geográfico.",
        },
      },
      {
        slug: "sbr-average-speed",
        type: "estimation",
        payloadSchemaVersion: 2,
        timeLimitMs: 22_000,
        publicPayload: {
          category: "Matemáticas",
          tags: {},
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
      {
        slug: "sbr-grand-canyon-heat-map",
        type: "heat-map",
        payloadSchemaVersion: 2,
        timeLimitMs: 18_000,
        publicPayload: {
          category: "Geografía",
          tags: {},
          question: "Marca aproximadamente dónde se encuentra el Gran Cañón.",
          surface: {
            assetId: "11111111-1111-4111-8111-111111111111",
            alt: "Mapa sin etiquetas de Estados Unidos",
            width: 1859,
            height: 968,
            fit: "contain",
          },
          targetLabel: "Norte de Arizona",
        },
        solutionPayload: {
          target: { x: 0.38, y: 0.58 },
          fullCreditRadius: 0.055,
          toleranceRadius: 0.18,
          explanation: "El Gran Cañón está en el norte de Arizona.",
        },
      },
      {
        slug: "sbr-race-anagram",
        type: "anagram",
        payloadSchemaVersion: 1,
        timeLimitMs: 30_000,
        publicPayload: {
          category: "Deporte",
          tags: {},
          question: "Forma una palabra relacionada con el desafío.",
          tiles: [
            { id: "a", value: "A" },
            { id: "c", value: "C" },
            { id: "r-1", value: "R" },
            { id: "r-2", value: "R" },
            { id: "a-2", value: "A" },
            { id: "e", value: "E" },
            { id: "r-3", value: "R" },
          ],
          hint: null,
        },
        solutionPayload: { correctAnswer: "CARRERA", explanation: "La palabra es carrera." },
      },
      {
        slug: "sbr-1890-gear-classification",
        type: "classification",
        payloadSchemaVersion: 1,
        timeLimitMs: 22_000,
        publicPayload: {
          category: "Tecnología",
          tags: {},
          question: "Clasifica cada objeto.",
          items: [{ label: "Brújula" }, { label: "Navegador GPS" }],
          categories: ["útil en 1890", "anacrónico"],
        },
        solutionPayload: {
          categoriesByItem: { Brújula: "útil en 1890", "Navegador GPS": "anacrónico" },
          explanation: "Clasificación histórica.",
        },
      },
      {
        slug: "logic-matrix-question",
        type: "logic-matrix",
        payloadSchemaVersion: 1,
        timeLimitMs: 20_000,
        publicPayload: {
          category: "Lógica visual",
          tags: {},
          question: "¿Qué pieza completa la matriz?",
          pieces: [
            { id: "circle-up", symbol: "●↑", label: "Círculo arriba" },
            { id: "triangle-right", symbol: "▲→", label: "Triángulo derecha" },
            { id: "square-down", symbol: "■↓", label: "Cuadrado abajo" },
            { id: "triangle-up", symbol: "▲↑", label: "Triángulo arriba" },
          ],
          cells: [
            "circle-up",
            "triangle-right",
            "square-down",
            "triangle-right",
            "square-down",
            "circle-up",
            "square-down",
            "circle-up",
            null,
          ],
          optionIds: ["triangle-up", "triangle-right", "circle-up", "square-down"],
          showPieceLabels: false,
        },
        solutionPayload: {
          correctOptionId: "triangle-up",
          explanation: "La tercera pieza completa la rotación.",
        },
      },
      {
        slug: "zip-final-answer",
        type: "zip",
        payloadSchemaVersion: 1,
        timeLimitMs: 35_000,
        publicPayload: {
          category: "Lógica espacial",
          tags: {},
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
          boardLabel: "Tablero Zip",
        },
        solutionPayload: {
          solution: [
            0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22,
            23, 24,
          ],
          explanation: "Recorrido serpenteante.",
        },
      },
    ];

    expect(
      documents.map((document) => parseFlashEditorialQuestionDocument(document)),
    ).toMatchObject([
      { type: "true-false" },
      { type: "odd-one-out" },
      { type: "ordering" },
      { type: "estimation" },
      { type: "heat-map" },
      { type: "anagram" },
      { type: "classification" },
      { type: "logic-matrix" },
      { type: "zip" },
    ]);
  });

  it("keeps logic-matrix solutions private and validates the matrix contract", () => {
    const question = {
      slug: "logic-matrix-private",
      type: "logic-matrix",
      payloadSchemaVersion: 1,
      timeLimitMs: 20_000,
      publicPayload: {
        question: "Completa la matriz",
        pieces: [
          { id: "a", symbol: "A", label: "A" },
          { id: "b", symbol: "B", label: "B" },
          { id: "c", symbol: "C", label: "C" },
          { id: "d", symbol: "D", label: "D" },
        ],
        cells: ["a", "b", "c", "b", "c", "a", "c", "a", null],
        optionIds: ["d", "a", "b", "c"],
      },
      solutionPayload: { correctOptionId: "d" },
    };
    const parsed = parseFlashEditorialQuestionDocument(question);
    expect(parsed.type).toBe("logic-matrix");
    expect(parsed.publicPayload).not.toHaveProperty("correctOptionId");
    expect(() =>
      parseFlashEditorialQuestionDocument({
        ...question,
        publicPayload: { ...question.publicPayload, correctOptionId: "d" },
      }),
    ).toThrow();
    expect(() =>
      parseFlashEditorialQuestionDocument({
        ...question,
        solutionPayload: { correctOptionId: "missing" },
      }),
    ).toThrow();
  });

  it("keeps Escape reference moves private and validates the editorial contract", () => {
    const question = {
      slug: "escape-private",
      type: "escape",
      payloadSchemaVersion: 1,
      timeLimitMs: 30_000,
      publicPayload: {
        question: "Libera el bloque amarillo.",
        grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
        initialBlocks: [
          { id: "target", kind: "target", orientation: "horizontal", row: 2, column: 0, length: 2 },
          { id: "a", kind: "obstacle", orientation: "vertical", row: 1, column: 2, length: 2 },
          { id: "b", kind: "obstacle", orientation: "vertical", row: 0, column: 4, length: 3 },
          { id: "c", kind: "obstacle", orientation: "horizontal", row: 0, column: 1, length: 2 },
          { id: "d", kind: "obstacle", orientation: "horizontal", row: 4, column: 1, length: 2 },
        ],
      },
      solutionPayload: {
        referenceSolution: [
          { blockId: "c", from: 1, to: 0 },
          { blockId: "a", from: 1, to: 0 },
          { blockId: "b", from: 0, to: 3 },
          { blockId: "target", from: 0, to: 4 },
        ],
        optimalMoves: 4,
      },
    };
    const parsed = parseFlashEditorialQuestionDocument(question);
    expect(parsed.type).toBe("escape");
    expect(parsed.publicPayload).not.toHaveProperty("referenceSolution");
    expect(parsed.publicPayload).not.toHaveProperty("optimalMoves");
    expect(() =>
      parseFlashEditorialQuestionDocument({
        ...question,
        publicPayload: { ...question.publicPayload, referenceSolution: [] },
      }),
    ).toThrow();
  });

  it("rejects invalid final-answer contracts", () => {
    const trueFalse = {
      slug: "invalid-true-false",
      type: "true-false",
      payloadSchemaVersion: 1,
      timeLimitMs: 12_000,
      publicPayload: { question: "¿Es correcto?" },
      solutionPayload: { correctAnswer: "false" },
    };
    expect(() => parseFlashEditorialQuestionDocument(trueFalse)).toThrow();

    const oddOneOut = {
      slug: "invalid-odd-one-out",
      type: "odd-one-out",
      payloadSchemaVersion: 1,
      timeLimitMs: 12_000,
      publicPayload: {
        question: "¿Cuál no pertenece?",
        items: [
          { id: "same", label: "Uno" },
          { id: "same", label: "Dos" },
          { id: "third", label: "Tres" },
        ],
      },
      solutionPayload: { correctAnswer: "third" },
    };
    expect(() => parseFlashEditorialQuestionDocument(oddOneOut)).toThrow();

    const ordering = {
      slug: "invalid-ordering",
      type: "ordering",
      payloadSchemaVersion: 1,
      timeLimitMs: 12_000,
      publicPayload: { question: "Ordena", items: ["A", "B", "C"] },
      solutionPayload: { correctOrder: ["A", "A", "B"] },
    };
    expect(() => parseFlashEditorialQuestionDocument(ordering)).toThrow();

    const anagram = {
      slug: "invalid-anagram",
      type: "anagram",
      payloadSchemaVersion: 1,
      timeLimitMs: 12_000,
      publicPayload: {
        question: "Forma una palabra",
        tiles: [
          { id: "a", value: "A" },
          { id: "b", value: "B" },
          { id: "c", value: "C" },
        ],
      },
      solutionPayload: { correctAnswer: "ABA" },
    };
    expect(() => parseFlashEditorialQuestionDocument(anagram)).toThrow();

    const classification = {
      slug: "invalid-classification",
      type: "classification",
      payloadSchemaVersion: 1,
      timeLimitMs: 12_000,
      publicPayload: {
        question: "Clasifica",
        items: [{ label: "Uno" }, { label: "Dos" }],
        categories: ["A", "B"],
      },
      solutionPayload: { categoriesByItem: { Uno: "A", Extra: "B" } },
    };
    expect(() => parseFlashEditorialQuestionDocument(classification)).toThrow();

    const estimation = {
      slug: "invalid-estimation",
      type: "estimation",
      payloadSchemaVersion: 2,
      timeLimitMs: 12_000,
      publicPayload: {
        question: "Estima",
        min: 10,
        max: 60,
        step: 5,
        initialValue: 12,
        unit: "km/h",
        media: null,
      },
      solutionPayload: { correctAnswer: 80, tolerance: -1 },
    };
    expect(() => parseFlashEditorialQuestionDocument(estimation)).toThrow();

    const heatMap = {
      slug: "invalid-heat-map",
      type: "heat-map",
      payloadSchemaVersion: 2,
      timeLimitMs: 12_000,
      publicPayload: {
        question: "Marca la zona",
        surface: {
          assetId: "11111111-1111-4111-8111-111111111111",
          alt: "Mapa",
          width: 800,
          height: 600,
        },
        targetLabel: "Zona objetivo",
      },
      solutionPayload: {
        target: { x: 1.2, y: 0.5 },
        fullCreditRadius: 0.2,
        toleranceRadius: 0.1,
      },
    };
    expect(() => parseFlashEditorialQuestionDocument(heatMap)).toThrow();
  });

  it("accepts Flash documents from two through twenty questions", () => {
    for (const count of [2, 3, 5, 20]) {
      const document = documentFixture();
      document.questions = Array.from({ length: count }, (_, index) => ({
        ...document.questions[index % 2],
        slug: `question-${index + 1}`,
        points: count === 2 ? 50 : count === 3 ? (index === 0 ? 34 : 33) : 100 / count,
      }));

      const parsed = parseFlashEditorialDocument(document);
      expect(parsed.questions).toHaveLength(count);
      expect(parsed.questions.reduce((total, question) => total + question.points, 0)).toBe(100);
    }
  });

  it("rejects Flash documents outside the question count and points contracts", () => {
    const tooFew = documentFixture();
    tooFew.questions = [tooFew.questions[0]];
    expect(() => parseFlashEditorialDocument(tooFew)).toThrow("entre 2 y 20");

    const tooMany = documentFixture();
    tooMany.questions = Array.from({ length: 21 }, (_, index) => ({
      ...tooMany.questions[index % 2],
      slug: `question-${index + 1}`,
      points: 1,
    }));
    expect(() => parseFlashEditorialDocument(tooMany)).toThrow("entre 2 y 20");

    for (const points of [0, -1, 1.5]) {
      const invalidPoints = documentFixture();
      invalidPoints.questions[0].points = points;
      invalidPoints.questions[1].points = 100 - points;
      expect(() => parseFlashEditorialDocument(invalidPoints)).toThrow("contrato Flash");
    }

    const invalidTotal = documentFixture();
    invalidTotal.questions[0].points = 40;
    expect(() => parseFlashEditorialDocument(invalidTotal)).toThrow("sumar 100");
  });

  it("rejects invalid JSON and unknown document fields", () => {
    expect(() => parseFlashEditorialJson("{")).toThrow("El documento no contiene JSON válido");
    expect(() => parseFlashEditorialDocument({ ...documentFixture(), extra: true })).toThrow(
      FlashEditorialValidationError,
    );
  });

  it("accepts an Alphabet envelope with published-library references", () => {
    const document = {
      ...documentFixture(),
      challenge: {
        ...documentFixture().challenge,
        mode: "alphabet",
        globalTimeLimitMs: 120_000,
      },
      questions: ["A", "B"].map((letter, index) => ({
        source: "library",
        questionVersionId: `00000000-0000-4000-8000-00000000010${index}`,
        points: 50,
        modeConfig: { letter },
      })),
    };
    expect(parseFlashEditorialDocument(document).challenge.mode).toBe("alphabet");
    expect(() =>
      parseFlashEditorialDocument({
        ...document,
        questions: [
          { ...document.questions[0], modeConfig: { letter: "A" } },
          { ...document.questions[1], modeConfig: { letter: "a" } },
        ],
      }),
    ).toThrow("letra única");
  });

  it("rejects unsupported point allocations and missing solutions", () => {
    const wrongPoints = documentFixture();
    wrongPoints.questions[1].points = 40;
    expect(() => parseFlashEditorialDocument(wrongPoints)).toThrow("sumar 100");
    const missingSolution = documentFixture();
    delete (missingSolution.questions[0] as { solutionPayload?: unknown }).solutionPayload;
    expect(() => parseFlashEditorialDocument(missingSolution)).toThrow("solutionPayload");
  });

  it("rejects secrets in public payloads and answers outside the options", () => {
    const secret = documentFixture();
    (secret.questions[0].publicPayload as Record<string, unknown>).correctAnswer = "A";
    expect(() => parseFlashEditorialDocument(secret)).toThrow("no puede contener soluciones");

    const invalidAnswer = documentFixture();
    invalidAnswer.questions[0].solutionPayload.correctAnswer = "C";
    expect(() => parseFlashEditorialDocument(invalidAnswer)).toThrow("contrato Flash");
  });

  it("accepts multiple-choice v2 with a private image asset reference", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "multiple-choice-private",
      type: "multiple-choice",
      payloadSchemaVersion: 2,
      timeLimitMs: 15_000,
      points: 50,
      publicPayload: {
        question: "¿Qué edificio aparece?",
        options: ["A", "B"],
        media: {
          type: "image",
          assetId: "00000000-0000-4000-8000-000000000099",
          alt: "Edificio histórico",
          width: 1200,
          height: 800,
          fit: "contain",
          position: "center",
        },
        promptVisual: null,
      },
      solutionPayload: { correctAnswer: "A" },
    };

    expect(parseFlashEditorialDocument(document).questions[1]).toMatchObject({
      type: "multiple-choice",
      payloadSchemaVersion: 2,
      publicPayload: { media: { assetId: "00000000-0000-4000-8000-000000000099" } },
    });
  });

  it("rejects a private multiple-choice media reference in v1 or with a public source in v2", () => {
    const v1 = documentFixture();
    v1.questions[0].publicPayload.media = {
      type: "image",
      assetId: "00000000-0000-4000-8000-000000000099",
      alt: "Imagen",
      width: 100,
      height: 100,
    };
    expect(() => parseFlashEditorialDocument(v1)).toThrow("contrato Flash");

    const v2 = documentFixture();
    v2.questions[1] = {
      ...v2.questions[1],
      payloadSchemaVersion: 2,
      publicPayload: {
        ...v2.questions[1].publicPayload,
        media: { type: "image", src: "/visuals/example.png", alt: "Imagen" },
      },
    };
    expect(() => parseFlashEditorialDocument(v2)).toThrow("contrato Flash");
  });

  it("rejects duplicate options and non-positive timers", () => {
    const duplicateOptions = documentFixture();
    duplicateOptions.questions[0].publicPayload.options = ["A", "A"];
    expect(() => parseFlashEditorialDocument(duplicateOptions)).toThrow("contrato Flash");

    const invalidTime = documentFixture();
    invalidTime.questions[0].timeLimitMs = 0;
    expect(() => parseFlashEditorialDocument(invalidTime)).toThrow("contrato Flash");
  });

  it("accepts a mixed Flash with a Mini-Wordle question", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "mini-wordle-2",
      type: "mini-wordle",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        category: "Lengua",
        tags: {},
        question: "Descubre el personaje bíblico",
        hint: "Una figura central del cristianismo",
        wordLength: 5,
        maxAttempts: 2,
      },
      solutionPayload: {
        correctAnswer: "Jesús",
        additionalGuesses: ["Josué", "Jacob", "David"],
        dictionaryId: "es-general-5.v1",
        explanation: "Una figura central del cristianismo.",
      },
    };

    const parsed = parseFlashEditorialDocument(document);
    const parsedQuestion = inlineQuestion(parsed.questions[1]);
    expect(parsedQuestion.type).toBe("mini-wordle");
    if (parsedQuestion.type !== "mini-wordle") throw new Error("Expected Mini-Wordle");
    expect(parsedQuestion.solutionPayload.correctAnswer).toBe("Jesús");
    expect(parsedQuestion.solutionPayload.additionalGuesses).toHaveLength(3);
  });

  it("rejects Mini-Wordle secrets, duplicate guesses, and mismatched dictionaries", () => {
    const document = documentFixture();
    const question = {
      slug: "mini-wordle-2",
      type: "mini-wordle",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        question: "Descubre la palabra",
        wordLength: 5,
        maxAttempts: 4,
      },
      solutionPayload: {
        correctAnswer: "libro",
        additionalGuesses: ["salas", "salas"],
        dictionaryId: "es-general-4.v1",
      },
    };
    document.questions[1] = question;
    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato Mini-Wordle");

    question.solutionPayload.additionalGuesses = ["salas"];
    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato Mini-Wordle");

    question.solutionPayload.additionalGuesses = ["LIBRO"];
    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato Mini-Wordle");

    (question.publicPayload as Record<string, unknown>).correctAnswer = "LIBRO";
    expect(() => parseFlashEditorialDocument(document)).toThrow("no puede contener soluciones");
  });

  it("accepts Matching and keeps its correspondence private", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "matching-2",
      type: "matching",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        question: "Relaciona los conceptos",
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
      solutionPayload: { matches: { l1: "r1", l2: "r2", l3: "r3" } },
    };

    const parsed = parseFlashEditorialDocument(document);
    const parsedQuestion = inlineQuestion(parsed.questions[1]);
    expect(parsedQuestion.type).toBe("matching");
    if (parsedQuestion.type !== "matching") throw new Error("Expected Matching");
    expect(parsedQuestion.publicPayload.leftItems).toHaveLength(3);
    expect(parsedQuestion.solutionPayload.matches).toEqual({ l1: "r1", l2: "r2", l3: "r3" });
  });

  it("accepts Progressive-image with a public source and private normalized answers", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "progressive-image-2",
      type: "progressive-image",
      payloadSchemaVersion: 1,
      timeLimitMs: 20_000,
      points: 50,
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
        answerLabel: "¿Qué aparece?",
        answerPlaceholder: "Tu respuesta…",
      },
      solutionPayload: {
        correctAnswer: "Torre Eiffel",
        acceptedAnswers: ["torre eiffel", "eiffel tower"],
        solutionAlt: "La Torre Eiffel en París",
        explanation: "La imagen muestra la Torre Eiffel.",
      },
    };

    const parsed = parseFlashEditorialDocument(document);
    expect(parsed.questions[1]).toMatchObject({
      type: "progressive-image",
      publicPayload: { surface: { src: "/visuals/connections/eiffel-tower.png" } },
      solutionPayload: { acceptedAnswers: ["torre eiffel", "eiffel tower"] },
    });
  });

  it("accepts Progressive-image v2 with a private asset reference", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "progressive-image-private",
      type: "progressive-image",
      payloadSchemaVersion: 2,
      timeLimitMs: 20_000,
      points: 50,
      publicPayload: {
        question: "¿Qué monumento aparece?",
        surface: {
          assetId: "00000000-0000-4000-8000-000000000099",
          alt: "Imagen progresivamente revelada de un monumento europeo",
          width: 847,
          height: 566,
          fit: "contain",
        },
        revealDurationMs: 12_000,
      },
      solutionPayload: {
        correctAnswer: "Torre Eiffel",
        acceptedAnswers: ["torre eiffel"],
        solutionAlt: "La Torre Eiffel en París",
        explanation: "La imagen muestra la Torre Eiffel.",
      },
    };

    const parsed = parseFlashEditorialDocument(document);
    expect(parsed.questions[1]).toMatchObject({
      type: "progressive-image",
      payloadSchemaVersion: 2,
      publicPayload: { surface: { assetId: "00000000-0000-4000-8000-000000000099" } },
    });
  });

  it("rejects a local source in a new private-asset Progressive-image version", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "progressive-image-private-invalid",
      type: "progressive-image",
      payloadSchemaVersion: 2,
      timeLimitMs: 20_000,
      points: 50,
      publicPayload: {
        question: "¿Qué monumento aparece?",
        surface: {
          src: "/visuals/connections/eiffel-tower.png",
          alt: "Imagen",
          width: 847,
          height: 566,
        },
        revealDurationMs: 12_000,
      },
      solutionPayload: {
        correctAnswer: "Torre Eiffel",
        acceptedAnswers: ["torre eiffel"],
        solutionAlt: "La Torre Eiffel en París",
      },
    };
    expect(() => parseFlashEditorialDocument(document)).toThrow("progressive-image");
  });

  it("rejects Progressive-image assets, dimensions, duration, and public solutions", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "progressive-image-invalid",
      type: "progressive-image",
      payloadSchemaVersion: 1,
      timeLimitMs: 20_000,
      points: 50,
      publicPayload: {
        question: "¿Qué aparece?",
        surface: { src: "https://example.com/image.png", alt: "Imagen", width: 0, height: 100 },
        revealDurationMs: 20_000,
      },
      solutionPayload: {
        correctAnswer: "Algo",
        acceptedAnswers: ["algo"],
        solutionAlt: "Solución",
      },
    };
    expect(() => parseFlashEditorialDocument(document)).toThrow("progressive-image");

    const valid = documentFixture();
    valid.questions[1] = {
      ...document.questions[1],
      publicPayload: {
        ...document.questions[1].publicPayload,
        surface: {
          src: "/visuals/connections/eiffel-tower.png",
          alt: "Imagen",
          width: 100,
          height: 100,
        },
        revealDurationMs: 10_000,
      },
    };
    (valid.questions[1].publicPayload as Record<string, unknown>).correctAnswer = "Algo";
    expect(() => parseFlashEditorialDocument(valid)).toThrow("no puede contener soluciones");

    const revealingAlt = documentFixture();
    revealingAlt.questions[1] = {
      ...document.questions[1],
      publicPayload: {
        ...document.questions[1].publicPayload,
        surface: {
          src: "/visuals/connections/eiffel-tower.png",
          alt: "Torre Eiffel",
          width: 100,
          height: 100,
        },
        revealDurationMs: 10_000,
      },
      solutionPayload: {
        correctAnswer: "Torre Eiffel",
        acceptedAnswers: ["torre eiffel"],
        solutionAlt: "La Torre Eiffel en París",
      },
    };
    expect(() => parseFlashEditorialDocument(revealingAlt)).toThrow("progressive-image");
  });

  it("rejects invalid Matching cardinality, labels, and mappings", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "matching-invalid",
      type: "matching",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        question: "Relaciona",
        leftItems: [
          { id: "l1", label: "Uno" },
          { id: "l2", label: "uno" },
        ],
        rightItems: [
          { id: "r1", label: "Primero" },
          { id: "r2", label: "Segundo" },
        ],
      },
      solutionPayload: { matches: { l1: "r1", l2: "r1" } },
    };
    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato matching");

    const valid = documentFixture();
    valid.questions[1] = {
      ...document.questions[1],
      publicPayload: {
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
      solutionPayload: { matches: { l1: "r1", l2: "r2", l3: "missing" } },
    };
    expect(() => parseFlashEditorialDocument(valid)).toThrow("contrato matching");
  });

  it("accepts a mixed Flash with a Logic-code question and preserves leading zeroes", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "logic-code-2",
      type: "logic-code",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        category: "Lógica",
        tags: {},
        question: "Descubre el código",
        codeLength: 4,
        clues: [
          { code: "1203", hint: "El segundo dígito es el doble del primero." },
          { code: "0312", hint: "El último dígito coincide con el tercero." },
        ],
      },
      solutionPayload: {
        correctAnswer: "0420",
        explanation: "La secuencia satisface ambas pistas.",
      },
    };

    const parsed = parseFlashEditorialDocument(document);
    const parsedQuestion = inlineQuestion(parsed.questions[1]);
    expect(parsedQuestion.type).toBe("logic-code");
    if (parsedQuestion.type !== "logic-code") throw new Error("Expected Logic-code");
    expect(parsedQuestion.publicPayload.codeLength).toBe(4);
    expect(parsedQuestion.solutionPayload.correctAnswer).toBe("0420");
  });

  it("rejects malformed Logic-code clues and solutions", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "logic-code-2",
      type: "logic-code",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        question: "Descubre el código",
        codeLength: 4,
        clues: [{ code: "012", hint: "Código demasiado corto" }],
      },
      solutionPayload: { correctAnswer: "0000" },
    };

    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato logic-code");
    (document.questions[1].publicPayload as Record<string, unknown>).clues = [
      { code: "0123", hint: "Pista" },
      { code: "0123", hint: "Duplicada" },
    ];
    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato logic-code");
  });

  it("accepts Progressive-clues and normalizes accepted answers for uniqueness", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "progressive-clues-2",
      type: "progressive-clues",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        category: "Historia",
        tags: {},
        question: "Identifica el acontecimiento",
        clues: ["Ocurrió en Europa.", "Sucedió en 1989."],
        cluePenalty: 25,
      },
      solutionPayload: {
        correctAnswer: "Caída del muro de Berlín",
        acceptedAnswers: ["caida del muro de berlin", "Berlín"],
        explanation: "La respuesta identifica el acontecimiento.",
      },
    };

    const parsed = parseFlashEditorialDocument(document);
    const parsedQuestion = inlineQuestion(parsed.questions[1]);
    expect(parsedQuestion.type).toBe("progressive-clues");
    if (parsedQuestion.type !== "progressive-clues") throw new Error("Expected Progressive-clues");
    expect(parsedQuestion.publicPayload.clues).toHaveLength(2);
    expect(parsedQuestion.solutionPayload.acceptedAnswers).toContain("Berlín");
  });

  it("rejects future-clue secrets and duplicate normalized accepted answers", () => {
    const document = documentFixture();
    document.questions[1] = {
      slug: "progressive-clues-2",
      type: "progressive-clues",
      payloadSchemaVersion: 1,
      timeLimitMs: 30000,
      points: 50,
      publicPayload: {
        question: "Identifica el acontecimiento",
        clues: ["Pista inicial", "Pista futura"],
        cluePenalty: 10,
      },
      solutionPayload: {
        correctAnswer: "Respuesta",
        acceptedAnswers: ["respuesta", " Res puesta "],
      },
    };
    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato progressive-clues");

    (document.questions[1].solutionPayload as Record<string, unknown>).acceptedAnswers = ["otra"];
    expect(() => parseFlashEditorialDocument(document)).toThrow("contrato progressive-clues");

    (document.questions[1].publicPayload as Record<string, unknown>).correctAnswer = "Respuesta";
    expect(() => parseFlashEditorialDocument(document)).toThrow("no puede contener soluciones");
  });
});
