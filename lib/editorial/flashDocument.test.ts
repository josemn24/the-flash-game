import { describe, expect, it } from "vitest";
import {
  FlashEditorialValidationError,
  isFlashEditorialDocument,
  parseFlashEditorialDocument,
  parseFlashEditorialJson,
} from "./flashDocument";

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
  it("accepts the supported envelope and preserves both private solutions", () => {
    const parsed = parseFlashEditorialDocument(documentFixture());

    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0].solutionPayload.correctAnswer).toBe("A");
    expect(isFlashEditorialDocument(parsed)).toBe(true);
  });

  it("rejects invalid JSON and unknown document fields", () => {
    expect(() => parseFlashEditorialJson("{")).toThrow("El documento no contiene JSON válido");
    expect(() => parseFlashEditorialDocument({ ...documentFixture(), extra: true })).toThrow(
      FlashEditorialValidationError,
    );
  });

  it("rejects unsupported formats, point allocations, and missing solutions", () => {
    expect(() =>
      parseFlashEditorialDocument({
        ...documentFixture(),
        challenge: { ...documentFixture().challenge, mode: "alphabet" },
      }),
    ).toThrow("challenge no cumple");
    const wrongPoints = documentFixture();
    wrongPoints.questions[1].points = 40;
    expect(() => parseFlashEditorialDocument(wrongPoints)).toThrow("questions[1]");
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
    expect(parsed.questions[1].type).toBe("mini-wordle");
    expect(parsed.questions[1].solutionPayload.correctAnswer).toBe("Jesús");
    if (parsed.questions[1].type !== "mini-wordle") throw new Error("Expected Mini-Wordle");
    expect(parsed.questions[1].solutionPayload.additionalGuesses).toHaveLength(3);
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
    expect(parsed.questions[1].type).toBe("logic-code");
    if (parsed.questions[1].type !== "logic-code") throw new Error("Expected Logic-code");
    expect(parsed.questions[1].publicPayload.codeLength).toBe(4);
    expect(parsed.questions[1].solutionPayload.correctAnswer).toBe("0420");
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
});
