// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewStage } from "@/components/game/modes/flash-pop/FlashPopCompetitiveHelpers";
import { getChallengeById } from "@/test-utils/mockGameplay";
import type { AnswerResult } from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";

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
  describe.each(["flash", "survival"] as const)("%s question cards", (presentation) => {
    it.each(["correct", "incorrect", "unanswered"] as const)(
      "shows the full question and preserves a %s result",
      (status) => {
        const question = {
          ...challenge.questions[0],
          category: "Cultura",
          question:
            "¿Qué cultura celebra el Año del Caballo de Fuego y cada cuántos años vuelve a celebrarse este acontecimiento en su calendario tradicional?",
        };
        const result = {
          ...makeResult(question.id, status),
          points: status === "correct" ? question.points : 0,
          answer: status === "unanswered" ? null : "La cultura china",
        };
        const container = document.createElement("div");
        container.innerHTML = renderToStaticMarkup(
          <ReviewStage
            challenge={{ ...challenge, questions: [question] }}
            results={[result]}
            onBack={() => {}}
            returnTo="/lobby"
            presentation={presentation}
          />,
        );
        const row = container.querySelector("details")!;
        expect(row.hasAttribute("open")).toBe(false);
        expect(row.querySelector("summary strong")?.textContent).toBe(question.question);
        expect(row.querySelector("summary small")?.textContent).toBe("Elección · Cultura");
        const fullQuestion = within(row).getByText("Pregunta").parentElement!;
        expect(fullQuestion.querySelector("p")?.textContent).toBe(question.question);
        expect(within(row).getByText(question.explanation)).toBeTruthy();
        expect(within(row).getByText(`${result.points} puntos · 1.0 s`)).toBeTruthy();
        expect(row.className).toContain(`reviewAnswer_${status}`);
      },
    );
  });

  it("counts multiple Flash answers including incorrect and unanswered results", () => {
    const markup = renderToStaticMarkup(
      <ReviewStage
        challenge={challenge}
        results={[
          makeResult(challenge.questions[0].id, "incorrect"),
          makeResult(challenge.questions[1].id, "unanswered"),
        ]}
        onBack={() => {}}
        returnTo="/lobby"
        presentation="flash"
      />,
    );
    expect(markup).toContain("2 respuestas");
    expect(markup).toContain('aria-label="Respuestas registradas"');
    expect(markup).toContain('aria-valuenow="2"');
    expect(markup).toContain('aria-valuemax="16"');
  });

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

    expect(markup).toContain("2 de 16 retos alcanzados");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-label="Retos alcanzados"');
    expect(markup).toContain('aria-valuenow="2"');
    expect(markup).toContain('aria-valuemax="16"');
    expect(markup.indexOf('aria-label="Volver al resultado"')).toBeLessThan(
      markup.indexOf("Historial de respuestas"),
    );
    expect(markup).not.toContain("Revisión");
    expect(markup).not.toContain("Tabarnia");
  });

  it("renders Flash response progress and puts result navigation above the title", () => {
    const markup = renderToStaticMarkup(
      <ReviewStage
        challenge={challenge}
        results={[makeResult(challenge.questions[0].id, "correct")]}
        onBack={() => {}}
        returnTo={roomContext.returnTo}
        roomContext={roomContext}
        presentation="flash"
      />,
    );

    expect(markup).toContain("1 respuesta");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-label="Respuestas registradas"');
    expect(markup).toContain('aria-valuenow="1"');
    expect(markup).toContain('aria-valuemax="16"');
    expect(markup.indexOf('aria-label="Volver al resultado"')).toBeLessThan(
      markup.indexOf("Historial de respuestas"),
    );
    expect(markup).not.toContain("Revisión");
    expect(markup).not.toContain("Tabarnia");
    expect(markup).not.toContain("superados");
  });

  it("keeps the original Survival total when the review challenge is filtered to reached questions", () => {
    const reachedChallenge = {
      ...challenge,
      questions: challenge.questions.slice(0, 13),
    };
    const results = reachedChallenge.questions.map((question, index) =>
      makeResult(question.id, index === 12 ? "incorrect" : "correct"),
    );
    const markup = renderToStaticMarkup(
      <ReviewStage
        challenge={reachedChallenge}
        results={results}
        onBack={() => {}}
        returnTo="/lobby"
        presentation="survival"
        totalQuestionCount={20}
      />,
    );

    expect(markup).toContain("13 de 20 retos alcanzados");
    expect(markup).toContain("Incorrecta");
    expect(markup).toContain('aria-valuenow="13"');
    expect(markup).toContain('aria-valuemax="20"');
    expect(markup).not.toContain("13 de 13");
  });
});
