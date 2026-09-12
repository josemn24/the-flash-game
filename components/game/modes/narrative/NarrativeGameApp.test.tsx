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
    expect(source).toContain("<section className={styles.questionPage}>");
    expect(source).not.toContain("questionMeta");
    expect(source).toContain("QuestionInput");
    expect(source).toContain("FlashPopFeedback");
    expect(source).toContain("getFlashPopFeedbackCopy");
    expect(source).toContain("feedbackStage");
    expect(source).toContain("key={`feedback-${session.stepIndex}`}");
    expect(source).toContain("exit={{ opacity: 0 }}");
    expect(source).not.toContain("Registro actualizado");
    expect(source).toContain("const isDarkPresentation");
    expect(source).toContain("styles.storyPageDark");
    expect(source).toContain("styles.darkStoryPhase");
    expect(source).toContain("styles.storyScreenImage");
    expect(styles).toContain(".storyScreenImage .storyPage");
    expect(styles).toContain(".storyScreenImage .storyPageArtifact .storyVisual");
  });

  it("does not fall back to the legacy question or transition surfaces", () => {
    expect(source).toContain('from "@/features/question-formats/QuestionInput"');
    expect(source).not.toContain("QuestionTransition");
    expect(source).not.toContain('variant="flash-pop"');
  });

  it("keeps narrative-specific imagery without interactive notebook chrome", () => {
    expect(source).toContain("NarrativeSceneScreen");
    expect(source).toContain("NarrativeSceneProgress");
    expect(source).toContain("storyFolio");
    expect(source).toContain("questionIndicator");
    expect(source).not.toContain("FieldNotebook");
    expect(source).not.toContain("NotebookButton");
    expect(source).not.toContain("NotebookIcon");
    expect(source).not.toContain("notebook=");
    const sceneSource = source.slice(
      source.indexOf("function NarrativeSceneScreen"),
      source.indexOf("function NarrativeQuestionScreen"),
    );
    expect(sceneSource).not.toContain("GameHeader");
    expect(source).toContain("isBlackoutScene");
    expect(styles).toContain("var(--color-surface)");
    expect(styles).toContain("var(--shadow-hero)");
    expect(styles).toContain("--story-muted");
    expect(styles).toContain(".storyPage.storyPageDark");
    expect(styles).toContain(".darkStoryPhase .flashPopCanvas");
    expect(styles).toContain("border-radius: 0;");
    expect(styles).toContain("border-radius: var(--radius-card);");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
