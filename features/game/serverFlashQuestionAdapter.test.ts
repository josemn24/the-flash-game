import { describe, expect, it } from "vitest";
import {
  displayChallenge,
  challengeWithReview,
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
});
