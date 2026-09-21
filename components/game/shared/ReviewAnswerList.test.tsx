import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
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
              points: -2,
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

  it("flattens narrative questions without including scene steps", () => {
    const challenge = getChallengeById("tabarnia-challenge-04");
    if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");

    expect(reviewQuestionsFor(challenge).every((question) => question.type !== undefined)).toBe(
      true,
    );
    expect(reviewQuestionsFor(challenge).length).toBeGreaterThan(0);
  });
});
