import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import { ReviewAnswers } from "@/components/game/shared/ReviewAnswers";

describe("ReviewAnswers", () => {
  it("uses the common history heading, statuses and replay copy", () => {
    const challenge = getChallengeById("tabarnia-challenge-03");
    if (challenge?.mode !== "survival") throw new Error("Expected survival challenge");

    const markup = renderToStaticMarkup(
      <ReviewAnswers
        challenge={challenge}
        results={[]}
        onBack={() => {}}
        onReplay={() => {}}
      />,
    );

    expect(markup).toContain("Historial de respuestas");
    expect(markup).toContain("Sin responder");
    expect(markup).toContain("Jugar de nuevo");
  });
});
