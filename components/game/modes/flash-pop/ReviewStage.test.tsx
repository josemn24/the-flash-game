import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewStage } from "@/components/game/modes/flash-pop/FlashPopFlashGame.client";
import { getChallengeById } from "@/test-utils/mockGameplay";
import type { AnswerResult, GameRoomContext } from "@/types/game";

const challenge = getChallengeById("tabarnia-flash-01");
if (challenge?.mode !== "flash") throw new Error("Expected flash challenge");

const roomContext: GameRoomContext = {
  roomId: "tabarnia-room",
  roomTitle: "Tabarnia",
  returnTo: "/salas/tabarnia-room",
  memberId: "member-1",
  availabilityStatus: "available",
  attemptStatus: "completed",
};

function makeResult(questionId: string, status: AnswerResult["status"]): AnswerResult {
  return {
    questionId,
    answer: null,
    status,
    isCorrect: status === "correct",
    points: 0,
    timeUsed: 1,
  };
}

describe("ReviewStage", () => {
  it("renders Survival progress from reached challenges, including failed and unanswered results", () => {
    const results = [
      makeResult(challenge.questions[0].id, "incorrect"),
      makeResult(challenge.questions[1].id, "unanswered"),
    ];
    const markup = renderToStaticMarkup(
      <ReviewStage
        challenge={challenge}
        results={results}
        onBack={() => {}}
        returnTo="/lobby"
        presentation="survival"
      />,
    );

    expect(markup).toContain("2 de 16 superados");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-label="Retos superados"');
    expect(markup).toContain('aria-valuenow="2"');
    expect(markup).toContain('aria-valuemax="16"');
    expect(markup.indexOf('aria-label="Volver al resultado"')).toBeLessThan(
      markup.indexOf("Historial de respuestas"),
    );
    expect(markup).not.toContain("Revisión");
    expect(markup).not.toContain("Tabarnia");
  });

  it("preserves the standard Flash header and response count", () => {
    const markup = renderToStaticMarkup(
      <ReviewStage
        challenge={challenge}
        results={[makeResult(challenge.questions[0].id, "correct")]}
        onBack={() => {}}
        returnTo={roomContext.returnTo}
        roomContext={roomContext}
      />,
    );

    expect(markup).toContain("Revisión");
    expect(markup).toContain("Tabarnia");
    expect(markup).toContain("1 respuestas");
    expect(markup).not.toContain('role="progressbar"');
    expect(markup).not.toContain("superados");
  });
});
