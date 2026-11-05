import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestionTransition } from "./QuestionTransition";

describe("QuestionTransition", () => {
  it("shows an estimation with zero proximity as failed with zero points", () => {
    const markup = renderToStaticMarkup(
      <QuestionTransition timedOut={false} isLast={false} status="incorrect" points={0} />,
    );

    expect(markup).toContain("Respuesta fallada");
    expect(markup).toContain("0 puntos");
  });
});
