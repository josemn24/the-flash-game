import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import { QuestionScreen } from "@/components/game/shared/QuestionScreen";

describe("QuestionScreen variants", () => {
  it("exposes the Flash Pop variant and remaining lives", () => {
    const challenge = getChallengeById("tabarnia-challenge-03");
    if (challenge?.mode !== "survival") throw new Error("Expected survival challenge");

    const markup = renderToStaticMarkup(
      <QuestionScreen
        variant="flash-pop"
        question={challenge.questions[0]}
        challengeTitle={challenge.title}
        questionNumber={1}
        totalQuestions={challenge.questions.length}
        locked={false}
        onSubmit={() => {}}
        onTimeUp={() => {}}
        codeAttemptCount={0}
        onCodeAttempt={() => false}
        onProgress={() => {}}
        onIncorrectAttempt={() => {}}
        onProgressiveClueReveal={() => {}}
        onTimedResponseStart={() => {}}
        livesRemaining={2}
        totalLives={3}
      />,
    );

    expect(markup).toContain('data-variant="flash-pop"');
    expect(markup).toContain("2 de 3 vidas restantes");
  });
});
