import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FlashPopQuestionInput } from "@/components/flash-pop/FlashPopQuestionInput";
import { getChallengeById } from "@/data/challenges";

describe("Flash Pop question adapter", () => {
  it("renders every format in tabarnia-challenge-06", () => {
    const challenge = getChallengeById("tabarnia-challenge-06");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");

    const markup = challenge.levels
      .map((level, levelIndex) =>
        renderToStaticMarkup(
          <FlashPopQuestionInput
            level={level}
            levelIndex={levelIndex}
            levelCount={challenge.levels.length}
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
});
