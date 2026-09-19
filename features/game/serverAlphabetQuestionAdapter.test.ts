import { describe, expect, it } from "vitest";
import {
  alphabetChallengeWithReview,
  questionFromAlphabetPayload,
  ServerAlphabetQuestionError,
} from "./serverAlphabetQuestionAdapter";

const challenge = {
  id: "publication-1",
  definitionId: "alphabet-1",
  number: 1,
  title: "Alfabeto",
  subtitle: "Responde",
  description: "Prueba",
  mode: "alphabet" as const,
  timeLimitMs: 120_000,
  entries: [
    {
      id: "item-a",
      position: 1,
      letter: "A",
      questionType: "short-text" as const,
      payloadSchemaVersion: 1,
      timeLimitMs: 30_000,
      points: 50,
    },
  ],
  maxScore: 100,
};

describe("server Alphabet question adapter", () => {
  it("accepts the public payload without requiring the solution", () => {
    expect(
      questionFromAlphabetPayload("item-a", "A", {
        category: "Historia",
        question: "¿Quién llegó primero?",
        answerPlaceholder: "Escribe un nombre",
      }, 30_000, 50),
    ).toMatchObject({
      type: "short-text",
      letter: "A",
      question: "¿Quién llegó primero?",
      answerPlaceholder: "Escribe un nombre",
    });
  });

  it("rejects a leaked solution in the gameplay payload", () => {
    expect(() =>
      questionFromAlphabetPayload("item-a", "A", {
        question: "Pregunta",
        correctAnswer: "Respuesta",
      }, 30_000, 50),
    ).toThrow(ServerAlphabetQuestionError);
  });

  it("rebuilds the legacy review only with terminal solution data", () => {
    const review = alphabetChallengeWithReview(challenge, [
      {
        challengeItemId: "item-a",
        publicPayload: { question: "¿Quién llegó primero?" },
        solutionPayload: {
          correctAnswer: "Ada",
          acceptedAnswers: ["Ada"],
          explanation: "Explicación",
        },
      },
    ]);
    expect(review.entries[0]?.question).toMatchObject({
      type: "short-text",
      correctAnswer: "Ada",
      acceptedAnswers: ["Ada"],
    });
  });
});
