import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import { FlashPopAlphabetGame } from "@/components/game/modes/flash-pop/FlashPopAlphabetGame.client";

const source = readFileSync(new URL("./FlashPopAlphabetGame.client.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./FlashPopAlphabetGame.module.css", import.meta.url), "utf8");

describe("FlashPopAlphabetGame", () => {
  it("renders the current Alphabet challenge with its real dimensions", () => {
    const challenge = getChallengeById("tabarnia-challenge-02");
    if (challenge?.mode !== "alphabet") throw new Error("Expected alphabet challenge");

    const markup = renderToStaticMarkup(<FlashPopAlphabetGame challenge={challenge} />);

    expect(markup).toContain("Alfabeto");
    expect(markup).toContain("18 letras");
    expect(markup).toContain("Comenzar desafío");
    expect(markup).toContain("Estado de las letras");
  });

  it("does not depend on the legacy Alphabet shell or dark effects", () => {
    expect(source).not.toContain("AlphabetGameApp");
    expect(source).not.toContain("SpeedBackground");
    expect(source).not.toContain("QuestionTransition");
    expect(source).not.toContain("localStorage");
  });

  it("keeps the legacy six-column gameplay grid on Pop surfaces", () => {
    expect(styles).toContain(".boardCard .boardCompact");
    expect(styles).toContain("grid-template-columns: repeat(6, minmax(0, 1fr));");
    expect(styles).toContain(".boardCard .boardCompact .letterCell");
    expect(styles).toContain("transform: none;");
  });
});
