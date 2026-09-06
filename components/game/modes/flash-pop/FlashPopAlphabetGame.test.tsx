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
    expect(styles).toContain("min-height: auto;");
  });

  it("keeps the question panel full width outside the board card", () => {
    expect(source).toContain("<section className={styles.questionPanel}");
    expect(source).not.toContain("className={styles.questionCard}");
    expect(styles).toContain(".questionPanel {");
    expect(styles).toContain("width: 100%;");
  });

  it("starts the question directly below the board without format metadata", () => {
    expect(source).not.toContain("questionHeading");
    expect(source).not.toContain("entry.question.category");
  });

  it("keeps the gameplay header free of redundant progress metadata", () => {
    expect(source).not.toContain("progressMeta");
    expect(source).not.toContain("Quedan {pendingLetters} letras");
    expect(source).not.toContain("Empieza por");
    expect(styles).not.toContain(".progressMeta");
  });

  it("avoids duplicated vertical space before the gameplay grid", () => {
    expect(styles).toContain("gap: var(--space-4);");
    expect(styles).toContain("padding: 0;");
  });

  it("keeps the answer input bright against the Pop canvas", () => {
    expect(styles).toContain(".answerForm input {");
    expect(styles).toContain("background: var(--color-surface);");
  });

  it("gives the countdown pill a high-contrast Pop treatment", () => {
    expect(source).toContain("className={styles.countdownChip}");
    expect(styles).toContain(".countdownChip {");
    expect(styles).toContain("background: var(--color-focus);");
    expect(styles).toContain("color: var(--color-text-on-social);");
  });

  it("keeps the countdown opaque while the number animates", () => {
    expect(source).toContain("initial={{ opacity: 1 }}");
    expect(source).toContain("animate={{ opacity: 1 }}");
  });

  it("does not let the countdown hint override the pill text color", () => {
    expect(source).toContain("className={styles.countdownHint}");
    expect(styles).toContain(".countdownHint {");
    expect(styles).not.toContain(".countdown > span");
  });

  it("keeps feedback inline with the question and the global timer mounted", () => {
    expect(source).toContain('session.phase === "playing" || session.phase === "feedback"');
    expect(source).toContain('variant="inline"');
    expect(source).toContain("active\n");
    expect(source).not.toContain("active={!locked}");
    expect(styles).toContain(".inlineFeedback {");
  });

  it("overlays feedback without adding vertical space to the question", () => {
    expect(styles).toContain(".questionPanel {");
    expect(styles).toContain("position: relative;");
    expect(styles).toContain("position: absolute;");
    expect(styles).toContain("inset: 0;");
    expect(styles).toContain("pointer-events: none;");
  });

  it("clears the answer when the next letter becomes active", () => {
    expect(source).toContain("key={entry.question.id}");
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("inputRef.current?.focus();");
  });

  it("uses the Pop rotate icon and spacing for the pass action", () => {
    expect(source).toContain("className={styles.passButton}");
    expect(source).toContain("trailingIcon={<RotateIcon />}");
    expect(styles).toContain(".passButton {");
    expect(styles).toContain("gap: var(--space-3);");
  });
});
