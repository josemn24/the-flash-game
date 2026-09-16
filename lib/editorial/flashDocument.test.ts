import { describe, expect, it } from "vitest";
import {
  FlashEditorialValidationError,
  isFlashEditorialDocument,
  parseFlashEditorialDocument,
  parseFlashEditorialJson,
} from "./flashDocument";

function documentFixture() {
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
    expect(() => parseFlashEditorialJson("{"))
      .toThrow("El documento no contiene JSON válido");
    expect(() => parseFlashEditorialDocument({ ...documentFixture(), extra: true }))
      .toThrow(FlashEditorialValidationError);
  });

  it("rejects unsupported formats, point allocations, and missing solutions", () => {
    expect(() => parseFlashEditorialDocument({
      ...documentFixture(),
      challenge: { ...documentFixture().challenge, mode: "alphabet" },
    })).toThrow("challenge no cumple");
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
});
