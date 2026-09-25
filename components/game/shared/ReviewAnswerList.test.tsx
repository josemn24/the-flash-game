import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/test-utils/mockGameplay";
import {
  buildReviewAnswerEntries,
  ReviewAnswerList,
  reviewQuestionsFor,
} from "@/components/game/shared/ReviewAnswerList";
import type { AnswerResult } from "@/types/game";

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
});
