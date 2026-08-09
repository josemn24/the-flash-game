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
  it("validates the production prototype contract", () => {
    expect(() => validateNarrativeChallengeDefinition(cloneDefinition())).not.toThrow();
  });

  it("accepts optional titles and mixed narration and dialogue blocks", () => {
    const definition = cloneDefinition();
    delete definition.prologue.title;
    definition.prologue.blocks = [
      { type: "narration", text: "The plane stops." },
      { type: "dialogue", speaker: "Nora", text: "Observe." },
    ];

    expect(() => validateNarrativeChallengeDefinition(definition)).not.toThrow();
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

  it("rejects unknown notebook references", () => {
    const definition = cloneDefinition();
    questionSteps(definition)[0].unlockEntryIds = ["note-missing"];

    expect(() => validateNarrativeChallengeDefinition(definition)).toThrow(
      "references unknown notebook entries",
    );
  });

  it("rejects duplicate question, scene and notebook IDs", () => {
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

    const duplicateNotebook = cloneDefinition();
    duplicateNotebook.notebookEntries[1].id = duplicateNotebook.notebookEntries[0].id;
    expect(() => validateNarrativeChallengeDefinition(duplicateNotebook)).toThrow(
      "notebook entry IDs must be unique",
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

  it("rejects incomplete scoring and totals other than 60", () => {
    const missing = cloneDefinition();
    delete missing.questionPoints["antarctica-cold-layer"];
    expect(() => validateNarrativeChallengeDefinition(missing)).toThrow(
      "missing points for questions",
    );

    const wrongTotal = cloneDefinition();
    wrongTotal.questionPoints["antarctica-cold-layer"] = 11;
    expect(() => validateNarrativeChallengeDefinition(wrongTotal)).toThrow(
      "must add up to 60 points",
    );

    const extraQuestion = cloneDefinition();
    extraQuestion.questionPoints["missing-question"] = 0;
    expect(() => validateNarrativeChallengeDefinition(extraQuestion)).toThrow(
      "scoring references unknown questions",
    );
  });
});
