import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
  getFlashPopFeedbackIconAnimation,
} from "./FlashPopFeedback";

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

  it("uses meaningful status copy for each transition", () => {
    expect(getFlashPopFeedbackCopy({ status: "correct" })).toEqual({
      title: "Respuesta correcta",
      body: "Siguiente pregunta en marcha.",
    });
    expect(getFlashPopFeedbackCopy({ status: "partial", nextLabel: "escena" })).toEqual({
      title: "Aproximación válida",
      body: "Sigue: aún quedan escenas.",
    });
    expect(getFlashPopFeedbackCopy({ status: "incorrect", nextLabel: "escena" })).toEqual({
      title: "Respuesta fallada",
      body: "Sigue: aún quedan escenas.",
    });
    expect(getFlashPopFeedbackCopy({ status: "unanswered", timedOut: true })).toEqual({
      title: "Tiempo agotado",
      body: "Sigue: aún quedan preguntas.",
    });
  });

  it("supports a compact inline layout without changing the default feedback", () => {
    const markup = renderToStaticMarkup(
      <FlashPopFeedback
        status="incorrect"
        eyebrow="Vuelta 1"
        title="Casi."
        body="Prueba otra."
        points={5}
        variant="inline"
      />,
    );

    expect(markup).toContain("inlineRoot");
    expect(markup).toContain("inlineStage");
    expect(markup).toContain("inlineCard");
    expect(markup).toContain("Casi.");
    expect(markup).not.toContain("Vuelta 1");
    expect(markup).not.toContain("Prueba otra.");
    expect(markup).not.toContain("+5 puntos");
  });
});
