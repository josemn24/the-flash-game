import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FlashPopQuestionInput } from "@/components/flash-pop/FlashPopQuestionInput";
import { getChallengeById } from "@/data/challenges";
import { questionsById } from "@/data/questions";

describe("Flash Pop question adapter", () => {
  it("renders every format in tabarnia-challenge-05", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const markup = challenge.levels
      .map((level) =>
        renderToStaticMarkup(
          <FlashPopQuestionInput
            question={level.question}
            locked={false}
            onSubmit={vi.fn()}
            onProgress={vi.fn()}
            onIncorrectAttempt={vi.fn()}
            onProgressiveClueReveal={vi.fn()}
            onCodeAttempt={vi.fn(() => false)}
            onTimedResponseStart={vi.fn()}
          />,
        ),
      )
      .join("\n");

    expect(markup).not.toContain("Este nivel todavía no está disponible");
    expect(markup).toContain('data-format="odd-one-out"');
    expect(markup).toContain('data-format="connect-pairs"');
    expect(markup).toContain('data-format="logic-code"');
    expect(markup).toContain('data-format="queens"');
  });

  it("renders every format in tabarnia-challenge-06", () => {
    const challenge = getChallengeById("tabarnia-challenge-06");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const markup = challenge.levels
      .map((level) =>
        renderToStaticMarkup(
          <FlashPopQuestionInput
            question={level.question}
            locked={false}
            onSubmit={vi.fn()}
            onProgress={vi.fn()}
            onIncorrectAttempt={vi.fn()}
            onProgressiveClueReveal={vi.fn()}
            onCodeAttempt={vi.fn(() => false)}
            onTimedResponseStart={vi.fn()}
          />,
        ),
      )
      .join("\n");

    expect(markup).not.toContain("Este nivel todavía no está disponible");
    expect(markup).toContain("Conceptos");
    expect(markup).toContain("Pista");
    expect(markup).toContain("Orden actual");
    expect(markup).toContain("Intentos de Mini-Wordle");
    expect(markup).toContain("Sopa de letras");
    expect(markup).toContain("Clasificación");
    expect(markup).toContain("Hashtag de cuatro palabras");
  });

  it("renders the ten formats used by the Flash pilot", () => {
    const challenge = getChallengeById("tabarnia-flash-01");
    if (challenge?.mode !== "flash") throw new Error("Expected flash challenge");

    const markup = challenge.questions
      .map((question) =>
        renderToStaticMarkup(
          <FlashPopQuestionInput
            question={question}
            locked={false}
            onSubmit={vi.fn()}
            onProgress={vi.fn()}
            onIncorrectAttempt={vi.fn()}
            onProgressiveClueReveal={vi.fn()}
            onCodeAttempt={vi.fn(() => false)}
            onTimedResponseStart={vi.fn()}
          />,
        ),
      )
      .join("\n");

    expect(markup).toContain("Verdadero");
    expect(markup).toContain("Falso");
    expect(markup).toContain("Mapa");
    expect(markup).toContain("Confirmar estimación");
    expect(markup).toContain('data-format="anagram"');
    expect(markup).toContain('data-format="progressive-image"');
  });

  it("keeps native Flash formats separate from legacy compatibility formats", () => {
    const challenge = getChallengeById("tabarnia-flash-01");
    if (challenge?.mode !== "flash") throw new Error("Expected flash challenge");

    const nativeFormats = new Set([
      "true-false",
      "odd-one-out",
      "multiple-choice",
      "ordering",
      "matching",
      "progressive-image",
      "heat-map",
      "estimation",
      "classification",
      "anagram",
    ]);

    for (const question of challenge.questions) {
      const markup = renderToStaticMarkup(
        <FlashPopQuestionInput
          question={question}
          locked={false}
          onSubmit={vi.fn()}
          onProgress={vi.fn()}
          onIncorrectAttempt={vi.fn()}
          onProgressiveClueReveal={vi.fn()}
          onCodeAttempt={vi.fn(() => false)}
          onTimedResponseStart={vi.fn()}
        />,
      );

      expect(markup).toContain(`data-format="${question.type}"`);
      if (nativeFormats.has(question.type)) {
        expect(markup).toContain("themeAwareFormat");
        expect(markup).not.toContain("legacyCompatFormat");
      } else {
        expect(markup).toContain("legacyCompatFormat");
        expect(markup).not.toContain("themeAwareFormat");
      }
    }
  });

  it("keeps the logic matrix on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["pyramid-shape-direction-matrix"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });

  it("keeps connect pairs on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["pyramid-connect-pairs-trap"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });

  it("keeps Queens on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["pyramid-summit-queens"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });

  it("keeps the word search on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["abrahamic-word-search-biblical-characters"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });

  it("keeps Mini-Wordle on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["abrahamic-mini-wordle-josue"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });

  it("keeps logic code on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["pyramid-secret-code"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });

  it("keeps word hashtag on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["abrahamic-word-hashtag-references"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });

  it("keeps progressive clues on its native Flash Pop theme", () => {
    const markup = renderToStaticMarkup(
      <FlashPopQuestionInput
        question={questionsById["abrahamic-progressive-abraham"]}
        locked={false}
        onSubmit={vi.fn()}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onProgressiveClueReveal={vi.fn()}
        onCodeAttempt={vi.fn(() => false)}
        onTimedResponseStart={vi.fn()}
      />,
    );

    expect(markup).toContain("themeAwareFormat");
    expect(markup).not.toContain("legacyCompatFormat");
  });
});
