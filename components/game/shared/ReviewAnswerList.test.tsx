import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById, questionsById } from "@/test-utils/mockGameplay";
import {
  buildReviewAnswerEntries,
  ReviewAnswerList,
  reviewQuestionsFor,
} from "@/components/game/shared/ReviewAnswerList";
import type { AnswerResult } from "@/types/gameplay";

describe("ReviewAnswerList", () => {
  it("normalizes every challenge question and marks unreachable pyramid levels as locked", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const firstResult: AnswerResult = {
      questionId: challenge.levels[0].question.id,
      answer: null,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: 4,
    };
    const entries = buildReviewAnswerEntries(challenge, [firstResult]);

    expect(entries).toHaveLength(challenge.levels.length);
    expect(entries[0].result).toEqual(firstResult);
    expect(entries[1].status).toBe("locked");
    expect(entries[1].lockedMessage).toContain("No alcanzado");
  });

  it("uses the common history card structure for statuses and long answers", () => {
    const challenge = getChallengeById("tabarnia-challenge-03");
    if (challenge?.mode !== "survival") throw new Error("Expected survival challenge");
    const question = challenge.questions[0];
    const markup = renderToStaticMarkup(
      <ReviewAnswerList
        entries={[
          {
            id: question.id,
            question,
            marker: "01",
            result: {
              questionId: question.id,
              answer: "Una respuesta suficientemente larga para no romper la tarjeta",
              status: "incorrect",
              isCorrect: false,
              points: 0,
              timeUsed: 0.6,
            },
          },
        ]}
      />,
    );

    expect(markup).toContain("reviewAnswer_incorrect");
    expect(markup).toContain("Incorrecta");
    expect(markup).toContain("Una respuesta suficientemente larga");
    expect(markup).toContain("0.6 s");
  });

  it("shows a selected heat-map point even when the answer is incorrect", () => {
    const challenge = getChallengeById("tabarnia-flash-01");
    if (challenge?.mode !== "flash") throw new Error("Expected flash challenge");
    const question = challenge.questions.find((candidate) => candidate.type === "heat-map");
    if (!question || question.type !== "heat-map") throw new Error("Expected heat-map question");

    const markup = renderToStaticMarkup(
      <ReviewAnswerList
        entries={[
          {
            id: question.id,
            question,
            marker: "06",
            result: {
              questionId: question.id,
              answer: { x: 0.2, y: 0.4 },
              status: "incorrect",
              isCorrect: false,
              points: 0,
              timeUsed: 8.4,
              details: {
                type: "heat-map",
                selectedPoint: { x: 0.2, y: 0.4 },
                targetPoint: question.target,
                distance: 0.4,
                accuracy: 0,
              },
            },
          },
        ]}
      />,
    );

    expect(markup).toContain("Punto sobre la imagen");
    expect(markup).not.toContain(">Sin respuesta<");
  });

  it("flattens narrative questions without including scene steps", () => {
    const challenge = getChallengeById("tabarnia-challenge-04");
    if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");

    expect(reviewQuestionsFor(challenge).every((question) => question.type !== undefined)).toBe(
      true,
    );
    expect(reviewQuestionsFor(challenge).length).toBeGreaterThan(0);
  });

  it.each([
    {
      name: "a successful legacy first attempt",
      answer: "427",
      status: "correct" as const,
      submittedCodes: [],
      incorrectAttempts: 0,
      expectedCodes: ["427"],
      expectedLabel: "Códigos enviados",
      expectedSummary: "1 intento · 16 puntos · 5.0 s",
    },
    {
      name: "a legacy success after two failed attempts",
      answer: "427",
      status: "correct" as const,
      submittedCodes: [],
      incorrectAttempts: 2,
      expectedCodes: ["427"],
      expectedLabel: "Último código enviado",
      expectedSummary: "3 intentos · 16 puntos · 5.0 s",
    },
    {
      name: "a complete history including the successful attempt",
      answer: "427",
      status: "correct" as const,
      submittedCodes: ["123", "427"],
      incorrectAttempts: 1,
      expectedCodes: ["123", "427"],
      expectedLabel: "Códigos enviados",
      expectedSummary: "2 intentos · 16 puntos · 5.0 s",
    },
    {
      name: "failed attempts before timeout",
      answer: null,
      status: "unanswered" as const,
      submittedCodes: ["123", "406"],
      incorrectAttempts: 2,
      expectedCodes: ["123", "406"],
      expectedLabel: "Códigos enviados",
      expectedSummary: "2 intentos · 0 puntos · 5.0 s",
    },
    {
      name: "a legacy timeout with missing codes and a persisted attempt count",
      answer: null,
      status: "unanswered" as const,
      submittedCodes: [],
      incorrectAttempts: 2,
      expectedCodes: [],
      expectedLabel: "Códigos no disponibles",
      expectedSummary: "2 intentos · 0 puntos · 5.0 s",
    },
  ])("shows $name consistently", (scenario) => {
    const question = questionsById["logic-connection"];
    if (question.type !== "logic-code") throw new Error("Expected logic-code question");

    const markup = renderToStaticMarkup(
      <ReviewAnswerList
        entries={[
          {
            id: question.id,
            question: { ...question, correctAnswer: "427" },
            marker: "06",
            result: {
              questionId: question.id,
              answer: scenario.answer,
              status: scenario.status,
              isCorrect: scenario.status === "correct",
              points: scenario.status === "correct" ? 16 : 0,
              timeUsed: 5,
              details: {
                type: "logic-code",
                submittedCodes: scenario.submittedCodes,
                incorrectAttempts: scenario.incorrectAttempts,
              },
            },
          },
        ]}
      />,
    );

    expect(markup).toContain(scenario.expectedLabel);
    expect(markup).toContain(scenario.expectedSummary);
    expect(markup).not.toContain(">Sin respuesta<");
    for (const code of scenario.expectedCodes) {
      expect(markup).toMatch(new RegExp(`<b[^>]*>${code}</b>`));
    }
  });

  it("shows no response and zero attempts only when no code was submitted", () => {
    const question = questionsById["logic-connection"];
    const markup = renderToStaticMarkup(
      <ReviewAnswerList
        entries={[
          {
            id: question.id,
            question,
            marker: "06",
            result: {
              questionId: question.id,
              answer: null,
              status: "unanswered",
              isCorrect: false,
              points: 0,
              timeUsed: 25,
              details: { type: "logic-code", submittedCodes: [], incorrectAttempts: 0 },
            },
          },
        ]}
      />,
    );

    expect(markup).toContain(">Sin respuesta<");
    expect(markup).toContain("0 intentos · 0 puntos · 25.0 s");
  });
});
