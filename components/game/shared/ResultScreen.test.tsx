import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { legacyChallenges } from "@/data/mock/legacyChallengeAdapter";
import type { FlashChallenge } from "@/types/game";
import { ResultScreen } from "./ResultScreen";

const challenge = legacyChallenges.find(({ mode }) => mode === "flash") as FlashChallenge;
const results = challenge.questions.map((question) => ({
  questionId: question.id,
  answer: null,
  status: "unanswered" as const,
  isCorrect: false,
  points: 0,
  timeUsed: 0,
}));

describe("ResultScreen", () => {
  it("hides replay when the caller does not provide it", () => {
    const markup = renderToStaticMarkup(
      <ResultScreen challenge={challenge} results={results} score={0} onReview={() => {}} />,
    );

    expect(markup).not.toContain("Volver a jugar");
  });

  it("keeps replay available for preview callers", () => {
    const markup = renderToStaticMarkup(
      <ResultScreen
        challenge={challenge}
        results={results}
        score={0}
        onReview={() => {}}
        onReplay={() => {}}
      />,
    );

    expect(markup).toContain("Volver a jugar");
  });
});
