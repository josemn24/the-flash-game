import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopReview } from "@/components/game/modes/flash-pop/FlashPopReview";
import { getChallengeById } from "@/data/challenges";
import type { AnswerResult } from "@/types/game";

describe("FlashPopReview", () => {
  it("exposes result navigation and an explicit replay action", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const result: AnswerResult = {
      questionId: challenge.levels[0].question.id,
      answer: null,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: challenge.levels[0].question.timeLimit,
    };
    const markup = renderToStaticMarkup(
      <FlashPopReview
        challenge={challenge}
        results={[result]}
        summary={{
          challengeId: challenge.id,
          levelsCleared: 0,
          score: 0,
          timeUsed: result.timeUsed,
          outcome: "failed",
          completedAt: 100,
        }}
        onBack={() => {}}
        onReplay={() => {}}
      />,
    );

    expect(markup).toContain("Volver al resultado");
    expect(markup).toContain("Jugar de nuevo");
    expect(markup).toContain("Historial de respuestas");
    expect(markup).toContain("No alcanzado");
  });
});
