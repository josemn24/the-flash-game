import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/test-utils/mockGameplay";
import { ReviewAnswers } from "@/components/game/shared/ReviewAnswers";

describe("ReviewAnswers", () => {
  it.each([
    { challengeId: "tabarnia-flash-01", format: "Elección" },
    { challengeId: "tabarnia-challenge-03", format: "V/F" },
  ])("shows the question in the $challengeId demo history", ({ challengeId, format }) => {
    const challenge = getChallengeById(challengeId);
    if (challenge?.mode !== "flash" && challenge?.mode !== "survival")
      throw new Error("Expected Flash or Survival challenge");
    const question = challenge.questions[0];
    const markup = renderToStaticMarkup(
      <ReviewAnswers challenge={challenge} results={[]} onBack={() => {}} />,
    );
    expect(markup).toContain(`<strong>${question.question}</strong>`);
    expect(markup).toContain(`<small>${format} · ${question.category}</small>`);
    expect(markup).toContain(`<span>Pregunta</span><p>${question.question}</p>`);
    expect(markup).toContain("0 respuestas");
  });

  it("uses the common history heading, statuses and replay copy", () => {
    const challenge = getChallengeById("tabarnia-challenge-03");
    if (challenge?.mode !== "survival") throw new Error("Expected survival challenge");

    const markup = renderToStaticMarkup(
      <ReviewAnswers challenge={challenge} results={[]} onBack={() => {}} onReplay={() => {}} />,
    );

    expect(markup).toContain("Historial de respuestas");
    expect(markup).toContain("Sin responder");
    expect(markup).toContain("Jugar de nuevo");
  });
});
