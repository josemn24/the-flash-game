import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import { buildAlphabetAnswerReviews } from "./alphabetReview";

describe("alphabet answer review adapter", () => {
  it("normalizes letter states into the shared review shape", () => {
    const challenge = getChallengeById("tabarnia-challenge-02");
    if (!challenge || challenge.mode !== "alphabet") throw new Error("Expected alphabet challenge");

    const reviews = buildAlphabetAnswerReviews(challenge, [
      {
        letter: challenge.entries[0].letter,
        questionId: challenge.entries[0].question.id,
        answer: "águila",
        status: "correct",
      },
    ]);

    expect(reviews[0]).toMatchObject({
      questionId: challenge.entries[0].question.id,
      answer: "águila",
      status: "correct",
      isCorrect: true,
    });
    expect(reviews[1]).toMatchObject({
      status: "unanswered",
      answer: null,
      isCorrect: false,
    });
  });
});
