import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import {
  getNarrativeReaction,
  getNarrativeSequence,
  initialNarrativeSessionState,
  narrativeSessionReducer,
} from "@/features/narrative/narrativeSession";
import type { AnswerResult } from "@/types/game";

const correctResult: AnswerResult = {
  questionId: "mountains-progressive-image",
  answer: "las montañas",
  status: "correct",
  isCorrect: true,
  points: 10,
  timeUsed: 4.2,
};

function getNarrativeChallenge() {
  const challenge = getChallengeById("tabarnia-challenge-04");
  if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");
  return challenge;
}

function reachFirstQuestion() {
  const started = narrativeSessionReducer(initialNarrativeSessionState, { type: "start" });
  return narrativeSessionReducer(started, { type: "advance", nextStepType: "question" });
}

describe("P-17 narrative session", () => {
  it("builds the exact eighteen-page sequence", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());

    expect(
      sequence.map((step) => (step.type === "scene" ? step.scene.id : step.question.id)),
    ).toEqual([
      "scene-prologue",
      "mountains-progressive-image",
      "scene-p17",
      "trajectory-deviation-heat-map",
      "scene-camera-limits",
      "observation-vs-interpretation",
      "scene-corridor",
      "clear-camp-escape",
      "scene-nadir",
      "p17-evidence-matrix",
      "scene-complete-line",
      "p17-route-zip",
      "scene-story-is-not-cause",
      "p17-observation-order",
      "scene-last-sheet",
      "p17-final-record",
      "scene-resolution",
      "scene-epilogue",
    ]);
  });

  it("keeps the final evidence statement immediately before the blackout", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());
    expect(sequence.at(-2)).toMatchObject({ type: "scene", scene: { id: "scene-resolution" } });
    expect(sequence.at(-1)).toMatchObject({
      type: "scene",
      scene: { id: "scene-epilogue", presentation: "blackout" },
    });
    const resolution = sequence.at(-2);
    expect(
      resolution?.type === "scene" &&
        resolution.scene.blocks.some((block) =>
          block.text.endsWith("La causa de la trayectoria no pudo determinarse."),
        ),
    ).toBe(true);
  });

  it("keeps the three chapters and eight evidence entries in narrative order", () => {
    const challenge = getNarrativeChallenge();
    expect(challenge.beats.map((beat) => beat.title)).toEqual([
      "Todos menos uno",
      "Mantenerse fuera",
      "La línea completa",
    ]);
    expect(challenge.notebookEntries.map((entry) => entry.id)).toEqual([
      "note-direction",
      "note-deviation",
      "note-register-rule",
      "note-intervention",
      "note-nadir",
      "note-route",
      "note-chronology",
      "note-final",
    ]);
    expect(challenge.notebookEntries.every((entry) => entry.relevance === "context")).toBe(true);
  });

  it("starts in the prologue and advances to the first timed proof", () => {
    const playing = reachFirstQuestion();
    expect(playing).toMatchObject({ phase: "playing", stepIndex: 1, locked: false });
    expect(getNarrativeSequence(getNarrativeChallenge())[playing.stepIndex]).toMatchObject({
      type: "question",
      question: { id: "mountains-progressive-image" },
    });
  });

  it.each([
    ["acierto", correctResult, false],
    [
      "fallo",
      { ...correctResult, answer: "mar", status: "incorrect", isCorrect: false, points: 0 },
      false,
    ],
    [
      "parcial",
      { ...correctResult, answer: "interior", status: "partial", isCorrect: false, points: 4 },
      false,
    ],
    [
      "timeout",
      { ...correctResult, answer: null, status: "unanswered", isCorrect: false, points: 0 },
      true,
    ],
  ] as const)("unlocks the same evidence after %s", (_label, result, timedOut) => {
    const transition = narrativeSessionReducer(reachFirstQuestion(), {
      type: "answer",
      result,
      timedOut,
      unlockEntryIds: ["note-direction"],
    });

    expect(transition).toMatchObject({
      phase: "transition",
      unlockedEntryIds: ["note-direction"],
      lastTimedOut: timedOut,
      locked: true,
    });
  });

  it.each([
    ["correct", correctResult, false, "cámara conserva"],
    [
      "incorrect",
      { ...correctResult, answer: "mar", status: "incorrect", isCorrect: false, points: 0 },
      false,
      "Nora congela",
    ],
    [
      "partial",
      { ...correctResult, answer: "interior", status: "partial", isCorrect: false, points: 4 },
      false,
      "Nora congela",
    ],
    [
      "timeout",
      { ...correctResult, answer: null, status: "unanswered", isCorrect: false, points: 0 },
      true,
      "termina de revelarse",
    ],
  ] as const)("selects the %s narrative reaction", (_label, result, timedOut, expected) => {
    const reaction = getNarrativeReaction(
      getNarrativeSequence(getNarrativeChallenge())[1],
      result,
      timedOut,
    );
    expect(reaction.some((block) => block.text.includes(expected))).toBe(true);
  });

  it("finishes after the blackout while preserving every result and evidence entry", () => {
    const challenge = getNarrativeChallenge();
    const results = challenge.beats
      .flatMap((beat) => beat.steps)
      .flatMap((step) =>
        step.type === "question"
          ? [{ ...correctResult, questionId: step.question.id, points: step.question.points }]
          : [],
      );
    const state = {
      ...reachFirstQuestion(),
      phase: "scene" as const,
      stepIndex: 17,
      results,
      unlockedEntryIds: challenge.notebookEntries.map((entry) => entry.id),
      locked: false,
    };

    expect(narrativeSessionReducer(state, { type: "advance", nextStepType: null })).toMatchObject({
      phase: "results",
      results,
      unlockedEntryIds: challenge.notebookEntries.map((entry) => entry.id),
    });
  });

  it("moves between result and review without losing progress", () => {
    const results = narrativeSessionReducer(
      { ...reachFirstQuestion(), phase: "scene", stepIndex: 17, results: [correctResult] },
      { type: "advance", nextStepType: null },
    );
    const review = narrativeSessionReducer(results, { type: "show-review" });
    expect(review).toMatchObject({ phase: "review", results: [correctResult] });
    expect(narrativeSessionReducer(review, { type: "show-results" })).toMatchObject({
      phase: "results",
      results: [correctResult],
    });
  });
});
