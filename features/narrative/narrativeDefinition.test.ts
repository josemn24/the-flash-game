import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { challengeDefinitions } from "@/data/challengeDefinitions";
import { validateNarrativeChallengeDefinition } from "@/data/challenges";
import type { QuestionId } from "@/data/questions";
import type { NarrativeChallengeDefinition, NarrativeReactionMap } from "@/types/game";

function cloneDefinition() {
  return structuredClone(
    challengeDefinitions["antarctica-narrative-definition"],
  ) as NarrativeChallengeDefinition;
}

function questionSteps(definition: NarrativeChallengeDefinition) {
  return definition.beats.flatMap((beat) => beat.steps.filter((step) => step.type === "question"));
}

describe("narrative challenge definition", () => {
  it("validates the complete production contract", () => {
    const definition = cloneDefinition();
    expect(() => validateNarrativeChallengeDefinition(definition)).not.toThrow();
    const scenes = [
      definition.prologue,
      ...definition.beats.flatMap((beat) =>
        beat.steps.flatMap((step) => (step.type === "scene" ? [step.scene] : [])),
      ),
    ];
    const imageSources = scenes.flatMap((scene) =>
      scene.media?.type === "image" ? [scene.media.src] : [],
    );
    expect(new Set(imageSources)).toEqual(
      new Set([
        "/visuals/p17/archive-recorder.jpg",
        "/visuals/p17/colony-panorama.jpg",
        "/visuals/p17/p17-identification.jpg",
        "/visuals/p17/observation-table.jpg",
        "/visuals/p17/camp-corridor.jpg",
        "/visuals/p17/cleared-camp.jpg",
        "/visuals/p17/nadir-monitor.jpg",
        "/visuals/p17/final-plain.jpg",
        "/visuals/p17/route-board.jpg",
      ]),
    );
    expect(imageSources.every((source) => existsSync(join(process.cwd(), "public", source)))).toBe(
      true,
    );
  });

  it("accepts optional labels and mixed narration, dialogue and emphasis blocks", () => {
    const definition = cloneDefinition();
    delete definition.prologue.title;
    delete definition.prologue.eyebrow;
    definition.prologue.blocks = [
      { type: "narration", text: "The plane stops." },
      { type: "dialogue", speaker: "Nora", text: "Observe." },
      { type: "emphasis", text: "Only the image remains." },
    ];

    expect(() => validateNarrativeChallengeDefinition(definition)).not.toThrow();
  });

  it("keeps a substantial literary voice and narrative reactions", () => {
    const definition = cloneDefinition();
    const scenes = [
      definition.prologue,
      ...definition.beats.flatMap((beat) =>
        beat.steps.flatMap((step) => (step.type === "scene" ? [step.scene] : [])),
      ),
    ];
    const storyText = scenes.flatMap((scene) => scene.blocks.map((block) => block.text)).join(" ");
    const reactionTexts = questionSteps(definition).flatMap((step) =>
      Object.values(step.reactions ?? {}).flatMap((blocks) => blocks.map((block) => block.text)),
    );

    expect(storyText.split(/\s+/).length).toBeGreaterThanOrEqual(1_000);
    expect(reactionTexts).toHaveLength(21);
    expect(reactionTexts.every((reaction) => reaction.split(/\s+/).length >= 8)).toBe(true);
    expect(`${storyText} ${reactionTexts.join(" ")}`).not.toMatch(
      /dirección observable|Sobre la mesa convivían|Registro actualizado|Sin tiempo competitivo/i,
    );
  });

  it("rejects empty blocks and dialogue without a speaker", () => {
    const emptyScene = cloneDefinition();
    emptyScene.prologue.blocks = [];
    expect(() => validateNarrativeChallengeDefinition(emptyScene)).toThrow(
      "must contain at least one narrative block",
    );

    const emptyText = cloneDefinition();
    emptyText.prologue.blocks = [{ type: "narration", text: "  " }];
    expect(() => validateNarrativeChallengeDefinition(emptyText)).toThrow(
      "contains an empty block",
    );

    const missingSpeaker = cloneDefinition();
    missingSpeaker.prologue.blocks = [{ type: "dialogue", speaker: " ", text: "Observe." }];
    expect(() => validateNarrativeChallengeDefinition(missingSpeaker)).toThrow(
      "contains dialogue without a speaker",
    );
  });

  it("requires all three reactions for every question", () => {
    const definition = cloneDefinition();
    delete (questionSteps(definition)[0].reactions as Partial<NarrativeReactionMap>).timeout;

    expect(() => validateNarrativeChallengeDefinition(definition)).toThrow(
      'is missing the "timeout" reaction',
    );
  });

  it("rejects duplicate question and scene IDs", () => {
    const duplicateQuestion = cloneDefinition();
    questionSteps(duplicateQuestion)[1].questionId = questionSteps(duplicateQuestion)[0].questionId;
    expect(() => validateNarrativeChallengeDefinition(duplicateQuestion)).toThrow(
      "question IDs must be unique",
    );

    const duplicateScene = cloneDefinition();
    const sceneStep = duplicateScene.beats[0].steps.find((step) => step.type === "scene");
    if (!sceneStep || sceneStep.type !== "scene") throw new Error("Expected scene step");
    sceneStep.scene.id = duplicateScene.prologue.id;
    expect(() => validateNarrativeChallengeDefinition(duplicateScene)).toThrow(
      "scene IDs must be unique",
    );
  });

  it("rejects duplicate movements and unknown question references", () => {
    const duplicateBeat = cloneDefinition();
    duplicateBeat.beats.push(structuredClone(duplicateBeat.beats[0]));
    expect(() => validateNarrativeChallengeDefinition(duplicateBeat)).toThrow(
      "beat IDs must be unique",
    );

    const unknownQuestion = cloneDefinition();
    questionSteps(unknownQuestion)[0].questionId = "missing-question" as QuestionId;
    expect(() => validateNarrativeChallengeDefinition(unknownQuestion)).toThrow(
      "references unknown questions",
    );
  });

  it("rejects incomplete scoring and totals other than 100", () => {
    const missing = cloneDefinition();
    delete missing.questionPoints["antarctic-circle-map"];
    expect(() => validateNarrativeChallengeDefinition(missing)).toThrow(
      "missing points for questions",
    );

    const wrongTotal = cloneDefinition();
    wrongTotal.questionPoints["antarctic-circle-map"] = 11;
    expect(() => validateNarrativeChallengeDefinition(wrongTotal)).toThrow(
      "must add up to 100 points",
    );

    const extraQuestion = cloneDefinition();
    extraQuestion.questionPoints["missing-question"] = 0;
    expect(() => validateNarrativeChallengeDefinition(extraQuestion)).toThrow(
      "scoring references unknown questions",
    );
  });
});
