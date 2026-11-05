import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/test-utils/mockGameplay";
import { getQuestionReviewCardContent } from "./questionReviewCardContent";

const challenge = getChallengeById("tabarnia-flash-01");
if (challenge?.mode !== "flash") throw new Error("Expected flash challenge");

describe("getQuestionReviewCardContent", () => {
  it.each([
    { category: "Cultura", subtitle: "Elección · Cultura" },
    { category: "", subtitle: "Elección" },
  ])("builds the card with category '$category'", ({ category, subtitle }) => {
    const question = { ...challenge.questions[0], category };
    expect(getQuestionReviewCardContent(question)).toEqual({
      title: question.question,
      subtitle,
    });
  });
});
