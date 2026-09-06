import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopFeedback, getFlashPopFeedbackIconAnimation } from "./FlashPopFeedback";

describe("FlashPopFeedback", () => {
  it("uses the Pyramid icon entrance for correct answers", () => {
    expect(getFlashPopFeedbackIconAnimation("correct")).toEqual({
      initial: { opacity: 0, scale: 0.45, rotate: -12 },
      animate: { opacity: 1, scale: 1, rotate: 0 },
      transition: { type: "spring", stiffness: 280, damping: 18 },
    });
  });

  it("uses the Pyramid icon entrance for incorrect answers", () => {
    expect(getFlashPopFeedbackIconAnimation("incorrect")).toEqual({
      initial: { opacity: 0, scale: 0.45, rotate: 12 },
      animate: { opacity: 1, scale: 1, rotate: 0 },
      transition: { type: "spring", stiffness: 280, damping: 18 },
    });
  });

  it("uses the failure entrance for timeout answers", () => {
    expect(getFlashPopFeedbackIconAnimation("unanswered")).toEqual({
      initial: { opacity: 0, scale: 0.45, rotate: 12 },
      animate: { opacity: 1, scale: 1, rotate: 0 },
      transition: { type: "spring", stiffness: 280, damping: 18 },
    });
  });

  it("keeps the feedback content and points intact", () => {
    const markup = renderToStaticMarkup(
      <FlashPopFeedback
        status="correct"
        eyebrow="Respuesta"
        title="¡Correcto!"
        body="Has acertado."
        points={5}
      />,
    );

    expect(markup).toContain("Respuesta");
    expect(markup).toContain("¡Correcto!");
    expect(markup).toContain("Has acertado.");
    expect(markup).toContain("+5 puntos");
  });
});
