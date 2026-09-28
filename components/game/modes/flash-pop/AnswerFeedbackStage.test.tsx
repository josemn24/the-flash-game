import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnswerFeedbackStage } from "./AnswerFeedbackStage";

describe("AnswerFeedbackStage", () => {
  it("keeps the checking shell quiet before the visibility threshold", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeedbackStage state="checking" indicatorVisible={false} />,
    );

    expect(markup).toContain('data-feedback-state="checking"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain("Comprobando respuesta…");
    expect(markup).not.toContain("spinner");
  });

  it("renders the loading feedback after the visibility threshold", () => {
    const markup = renderToStaticMarkup(<AnswerFeedbackStage state="checking" indicatorVisible />);

    expect(markup).toContain("Comprobando respuesta…");
    expect(markup).toContain("Espera un momento…");
    expect(markup).toContain("spinner");
    expect(markup).toContain('aria-live="polite"');
  });

  it("renders a retryable verification error", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeedbackStage
        state="error"
        errorMessage="No hemos podido confirmar tu respuesta."
        onRetry={vi.fn()}
      />,
    );

    expect(markup).toContain("No hemos podido confirmar tu respuesta.");
    expect(markup).toContain("Reintentar");
    expect(markup).toContain('data-feedback-state="error"');
  });
});
