import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Transition } from "./FlashPopCompetitiveHelpers";

describe("FlashPop competitive transition", () => {
  it("shows zero-proximity estimates as failed with zero points", () => {
    const markup = renderToStaticMarkup(
      <Transition
        result={{
          questionId: "estimation",
          answer: 18,
          status: "incorrect",
          isCorrect: false,
          points: 0,
          timeUsed: 6,
          details: { type: "estimation", difference: 18, proximity: 0 },
        }}
        timedOut={false}
        isLast={false}
      />,
    );

    expect(markup).toContain("Respuesta fallada");
    expect(markup).toContain("0 puntos");
  });
});
