import { describe, expect, it } from "vitest";
import {
  displayChallenge,
  questionFromPayload,
  ServerFlashQuestionError,
} from "./serverFlashQuestionAdapter";

const serverChallenge = {
  id: "scheduled-1",
  definitionId: "definition-1",
  number: 1,
  title: "Flash de pruebas",
  subtitle: "Flash clásico",
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

  it("builds a renderer-safe challenge from metadata-only slots", () => {
    const challenge = displayChallenge(serverChallenge);

    expect(challenge).toMatchObject({
      id: "scheduled-1",
      mode: "flash",
      questions: [{ id: "item-1", type: "multiple-choice", options: [] }],
    });
    expect(challenge).not.toHaveProperty("slots");
  });
});
