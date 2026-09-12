import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChallengeResultScreen } from "./ChallengeResultScreen";

function getModel(metricCount: 3 | 4 = 3) {
  return {
    gameTitle: "Flash clásico",
    statusLabel: "Completado",
    eyebrow: "Desafío completado",
    title: "Sprint brutal.",
    score: 78,
    maxScore: 100,
    accuracy: 93,
    totalTime: 137,
    metrics: Array.from({ length: metricCount }, (_, index) => ({
      label: `Métrica ${index + 1}`,
      value: index + 1,
    })),
  };
}

describe("ChallengeResultScreen", () => {
  it("renders the shared score, progress, accuracy and time", () => {
    const markup = renderToStaticMarkup(
      <ChallengeResultScreen model={getModel()} onReview={vi.fn()} onReplay={vi.fn()} />,
    );

    expect(markup).toContain("Sprint brutal.");
    expect(markup).toContain("78");
    expect(markup).toContain("/100 puntos");
    expect(markup).toContain('aria-label="78 de 100 puntos"');
    expect(markup).toContain("93%");
    expect(markup).toContain("2 min 17 s");
    expect(markup).toContain("Volver a jugar");
    expect(markup).toContain("Ver respuestas");
  });

  it("supports three and four mode-specific metrics", () => {
    const three = renderToStaticMarkup(
      <ChallengeResultScreen model={getModel(3)} onReview={() => {}} onReplay={() => {}} />,
    );
    const four = renderToStaticMarkup(
      <ChallengeResultScreen model={getModel(4)} onReview={() => {}} onReplay={() => {}} />,
    );

    expect(three).toContain('data-count="3"');
    expect(four).toContain('data-count="4"');
    expect(four).toContain("Métrica 4");
  });

  it("renders optional supplemental content and return navigation", () => {
    const markup = renderToStaticMarkup(
      <ChallengeResultScreen
        model={{ ...getModel(), supplementalContent: <p>Clasificación demo</p> }}
        onReview={() => {}}
        onReplay={() => {}}
        returnTo="/sala/demo"
        returnLabel="Volver a la sala"
      />,
    );

    expect(markup).toContain("Clasificación demo");
    expect(markup).toContain('href="/sala/demo"');
    expect(markup).toContain("Volver a la sala");
  });
});
