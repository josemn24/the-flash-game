import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";

const source = readFileSync(new URL("./NarrativeGameApp.client.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./NarrativeGame.module.css", import.meta.url), "utf8");

describe("Narrative Flash Pop migration", () => {
  it("uses the Flash Pop shell and preserves the real narrative challenge formats", () => {
    const challenge = getChallengeById("tabarnia-challenge-04");
    if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");

    const questions = challenge.beats.flatMap((beat) =>
      beat.steps.flatMap((step) => (step.type === "question" ? [step.question] : [])),
    );

    expect(questions).toHaveLength(8);
    expect([...new Set(questions.map((question) => question.type))].sort()).toEqual([
      "classification",
      "escape",
      "multiple-choice",
      "ordering",
      "zip",
    ]);
    expect(source).toContain("<Canvas");
    expect(source).toContain('<Card as="section"');
    expect(source).toContain("FlashPopQuestionInput");
    expect(source).toContain("FlashPopFeedback");
    expect(source).toContain('data-variant="flash-pop"');
  });

  it("does not fall back to the legacy question or transition surfaces", () => {
    expect(source).not.toContain('from "@/features/question-formats/QuestionInput"');
    expect(source).not.toContain("QuestionTransition");
    expect(source).toContain('variant="flash-pop"');
  });

  it("keeps narrative-specific imagery and the themed notebook surfaces", () => {
    expect(source).toContain("NarrativeSceneScreen");
    expect(source).toContain("FieldNotebook");
    expect(source).toContain("isBlackoutScene");
    expect(styles).toContain("var(--color-surface)");
    expect(styles).toContain("var(--shadow-hero)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
