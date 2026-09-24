import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopReview } from "@/components/game/modes/flash-pop/FlashPopReview";
import { getChallengeById } from "@/test-utils/mockGameplay";
import type { AnswerResult } from "@/types/game";

describe("FlashPopReview", () => {
  it("exposes result navigation without a competitive replay action", () => {
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
          startedAt: 0,
        }}
        onBack={() => {}}
      />,
    );

    expect(markup).toContain("Volver al resultado");
    expect(markup).not.toContain("Jugar de nuevo");
    expect(markup).toContain("Historial de respuestas");
    expect(markup).toContain("No alcanzado");
  });

  it("renders all pyramid levels while keeping unreached questions out of the review payload", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const reachedQuestion = challenge.levels[0].question;
    const privateUnreachedPrompt = challenge.levels[1].question.question;
    const metadata = challenge.levels.map((level, index) => ({
      id: level.id,
      resultQuestionId: level.question.id,
      label: `Nivel ${index + 1}`,
      briefingTitle: level.briefing.title,
      ...(index === 0 ? { question: reachedQuestion } : {}),
    }));
    const markup = renderToStaticMarkup(
      <FlashPopReview
        challenge={{
          ...challenge,
          levels: [challenge.levels[0]],
        }}
        levelMetadata={metadata}
        totalLevelCount={7}
        results={[
          {
            questionId: reachedQuestion.id,
            answer: null,
            status: "unanswered",
            isCorrect: false,
            points: 0,
            timeUsed: reachedQuestion.timeLimit,
          },
        ]}
        summary={{
          challengeId: challenge.id,
          levelsCleared: 0,
          score: 0,
          timeUsed: 0,
          outcome: "failed",
          completedAt: 100,
          startedAt: 0,
        }}
        onBack={() => {}}
      />,
    );

    expect(markup.match(/<details/g)).toHaveLength(7);
    expect(markup.match(/reviewAnswer_locked/g)).toHaveLength(6);
    expect(markup).toContain("No alcanzado");
    expect(markup).not.toContain(privateUnreachedPrompt);
  });
});
